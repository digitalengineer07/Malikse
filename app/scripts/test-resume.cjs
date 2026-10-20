const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/store/resumeStore.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let saved;
function load(platform = 'android', broken = false) {
  const exports = {};
  vm.runInNewContext(source, { exports, Promise, require: name => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
      getItem: async () => { if (broken) throw Error('Unavailable'); return saved ?? null; },
      setItem: async (_key, value) => { if (broken) throw Error('Unavailable'); saved = value; },
      removeItem: async () => { saved = undefined; },
    } };
    return require(name);
  } });
  return exports;
}
async function main() {
  const first = load();
  await first.hydrateResume();
  first.useResumeStore.getState().setTab('/search');
  first.useResumeStore.getState().setSearch({ query: 'Patna', type: 'plot', state: { key: 'Bihar', name: 'Bihar', count: 3, lat: 25, lng: 85 } });
  first.useResumeStore.getState().setSearch({ query: 'Patna City' });
  await new Promise(resolve => setImmediate(resolve));
  const restarted = load();
  assert.equal(restarted.useResumeStore.getState().tab, '/home');
  await restarted.hydrateResume();
  assert.equal(restarted.useResumeStore.getState().tab, '/search');
  assert.equal(restarted.useResumeStore.getState().search.query, 'Patna City');
  assert.equal(restarted.useResumeStore.getState().search.state.key, 'Bihar');
  const web = load('web');
  await web.hydrateResume();
  assert.equal(web.useResumeStore.getState().tab, '/home');
  const unavailable = load('android', true);
  await unavailable.hydrateResume();
  assert.equal(unavailable.useResumeStore.getState().tab, '/home');
  saved = 'invalid JSON';
  const corrupt = load();
  await corrupt.hydrateResume();
  assert.equal(corrupt.useResumeStore.getState().tab, '/home');
  console.log('PASS cold-start tab/search restoration, ordered writes, web isolation, unavailable/corrupt storage');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

