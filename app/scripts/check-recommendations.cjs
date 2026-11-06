const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let stored;
const storage = { getItem: async () => stored, setItem: async (_, value) => { stored = value; } };
function load(filename, native) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, {
    exports, require: () => storage, setTimeout, clearTimeout,
    window: native ? undefined : { localStorage: { getItem: () => null, setItem() {} } },
  });
  return exports;
}
const nativePath = path.join(__dirname, '../src/services/recommendationEngine.ts');
const webPath = path.join(__dirname, '../../website/src/services/recommendationEngine.ts');
async function main() {
  let native = load(nativePath, true);
  const web = load(webPath, false);
  await native.hydrateUserAffinity();
  const properties = [
    { id: 'a', title: 'Residential villa', type: 'house', price: 3000000, location: { district: 'Patna' }, badges: { fullyVerified: true } },
    { id: 'b', title: 'Commercial office', type: 'office', price: 8000000, location: { district: 'Gaya' } },
    { id: 'c', title: 'Investment highway land', type: 'land', price: 4500000, location: { district: 'Patna' } },
  ];
  native.setUserCustomPreferences({ district: 'Gaya', intent: 'commercial', budgetMax: 9000000 });
  native.trackPropertyInteraction(properties[1], 'view');
  native.trackPropertyInteraction(properties[1], 'save');
  for (const category of ['for_you', 'residential', 'commercial', 'investment', 'budget']) {
    const ids = engine => JSON.stringify(engine.getRecommendedProperties(properties, category, native.getUserAffinity(), 0).map(p => p.id));
    assert.equal(ids(native), ids(web), `website scoring parity: ${category}`);
  }
  assert.equal(native.getRecommendedProperties(properties, 'for_you')[0].id, 'b');
  assert.equal(native.getRecommendedProperties(properties, 'for_you', undefined, 2).length, 2);
  await new Promise(resolve => setImmediate(resolve));
  native = load(nativePath, true);
  const reloaded = await native.hydrateUserAffinity();
  assert.equal(reloaded.preferredDistrict, 'Gaya');
  assert.equal(reloaded.savedIds[0], 'b');
  native.setUserCustomPreferences({});
  assert.equal(native.getUserAffinity().preferredDistrict, undefined);
  assert.equal(native.getUserAffinity().preferredIntent, undefined);
  assert.equal(native.getUserAffinity().preferredBudgetMax, undefined);
  await new Promise(resolve => setImmediate(resolve));
  stored = 'invalid JSON';
  const recovered = await load(nativePath, true).hydrateUserAffinity();
  assert.equal(recovered.viewedIds.length, 0);
  console.log('PASS: website ranking parity, category filters, result limits, interaction learning, persistent reload, preference reset and corrupt-storage recovery');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
