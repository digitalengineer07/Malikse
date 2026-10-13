const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require('./generate-native-map.cjs');
function load(relative) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext('Function.prototype.toString = function () { return "function () { [native code] }"; };\n' + source, { exports, require: name => load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))), document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) } });
  return exports;
}
const { addRegionBoundaries } = load('src/utils/regionBoundaryLayer.ts');
let grid, control, selection, tile;
const markers = [];
const makeElement = () => ({ appendChild() {} });
const map = { removeLayer() {}, removeControl() {}, unproject(point) { return point; } };
const L = {
  VectorGrid: { Protobuf: { prototype: { _getVectorTilePromise: async () => tile }, extend: methods => class { constructor(url, options) { this.url = url;this.options = options;this.events = {};Object.assign(this, methods);grid = this; } on(name, fn) { this.events[name] = fn;return this; } addTo() { return this; } } } },
  point: (x, y) => ({ x, y }), divIcon: options => options,
  marker: (position, options) => { const marker = { position, options, addTo() { markers.push(this);return this; }, setLatLng(value) { this.position = value;return this; } };return marker; },
  tooltip: () => ({ setLatLng() { return this; },setContent() { return this; },addTo() { return this; } }),
  control: () => { control = { addTo() { this.onAdd();return this; } };return control; },
  DomUtil: { create: makeElement }, DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
};
const group = (key) => ({ key, name: key, count: 10, lat: 25.6, lng: 85.1 });
async function main() {
const { regionBoundaryScript } = load('src/utils/regionBoundaryScript.ts');
const embeddedBoundaries = vm.runInNewContext(regionBoundaryScript, { document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) } });
for (const boundaries of [addRegionBoundaries, embeddedBoundaries]) {
for (const fixture of [
  { level: 'state', key: 'Bihar', layer: 'SOI_States', properties: { STATE: 'BIHĀR', STATE_C: 'BIHAR' } },
  { level: 'district', key: 'Patna', layer: 'SOI_Districts', properties: { STATE_C: 'BIHAR', District_C: 'PATNA' } },
  { level: 'pincode', key: '800001', layer: 'Datagov_Pincode_Boundaries', properties: { Pincode: '800001' } },
]) {
  selection = undefined;
  markers.length = 0;
  const cleanup = boundaries(L, map, { level: fixture.level, state: 'Bihar', groups: [group(fixture.key), group('Another area')] }, key => { selection = key; }, () => assert.fail('Unexpected tile error'));
  const style = grid.options.vectorTileLayerStyles[fixture.layer];
  assert.equal(style(fixture.properties)[1].fillOpacity, 0.16);
  const otherProperties = { STATE_C: 'Another area', District_C: 'Another area', Pincode: 'Another area' };
  if (fixture.level === 'district') otherProperties.STATE_C = 'BIHAR';
  assert.notEqual(style(fixture.properties)[1].color, style(otherProperties)[1].color);
  assert.equal(style({}).length, 0);
  if (fixture.level === 'district') assert.equal(style({ ...fixture.properties, STATE_C: 'UTTAR PRADESH' }).length, 0, 'same-name district in another state must stay hidden');
  grid.events.click({ layer: { properties: fixture.properties } });
  assert.equal(selection, fixture.key);
  grid.events.click({ layer: { properties: {} } });
  assert.equal(selection, fixture.key);
  const ring = values => values.map(([x, y]) => ({ x, y }));
  tile = { layers: { [fixture.layer]: { extent: 100, features: [{ type: 3, properties: fixture.properties, geometry: [ring([[0,0],[100,0],[100,100],[0,100],[0,0]]), ring([[30,30],[30,70],[70,70],[70,30],[30,30]])] }] } } };
  await grid._getVectorTilePromise({ x: 0, y: 0, z: 0 });
  await grid._getVectorTilePromise({ x: 0, y: 0, z: 0 });
  assert.equal(markers.length, 1, 'one count tag per area across repeated tile loads');
  const anchor = markers[0].position;
  const x = anchor.x / 256 * 100, y = anchor.y / 256 * 100;
  assert.ok(x > 0 && x < 100 && y > 0 && y < 100);
  assert.ok(!(x > 30 && x < 70 && y > 30 && y < 70), 'tag must not land inside a polygon hole');
  assert.equal(markers[0].options.icon.html.textContent, '10');
  selection = undefined;
  markers[0].options.icon.html.onclick({ stopPropagation() {} });
  assert.equal(selection, fixture.key, 'count tag must drill down');
  cleanup();
  await grid._getVectorTilePromise({ x: 0, y: 0, z: 0 });
  assert.equal(markers.length, 1, 'late tile responses must not recreate removed tags');
}
const { nativeMapHtml } = load('src/utils/nativeMapHtml.ts');
const html = nativeMapHtml({ regions: { level: 'state', groups: [group('</script><script>bad</script>')] } });
assert.ok(html.includes('leaflet.vectorgrid@1.3.0'));
assert.ok(!html.includes('</script><script>bad'));
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
assert.ok(!nativeMapHtml({ points: [] }).includes('leaflet.vectorgrid@'));
}
const authSource = fs.readFileSync(path.join(root, 'src/services/authService.ts'), 'utf8');
const resolver = authSource.slice(authSource.indexOf('function resolveApiUrl()'), authSource.indexOf('const API_URL'));
for (const fixture of [
  { url: 'http://localhost:5000', dev: false, platform: 'android', expected: 'https://malikse.onrender.com' },
  { url: 'http://127.0.0.1:5000', dev: false, platform: 'android', expected: 'https://malikse.onrender.com' },
  { url: 'http://10.0.2.2:5000', dev: false, platform: 'android', expected: 'https://malikse.onrender.com' },
  { url: 'https://staging.example.com', dev: false, platform: 'android', expected: 'https://staging.example.com' },
  { url: 'http://localhost:5000', dev: true, platform: 'android', expected: 'http://192.168.1.5:5000' },
  { url: 'http://localhost:5000', dev: false, platform: 'web', expected: 'http://localhost:5000' },
]) {
  assert.equal(vm.runInNewContext(resolver + '\nresolveApiUrl()', { configuredApiUrl: fixture.url, __DEV__: fixture.dev, Platform: { OS: fixture.platform }, Constants: { expoConfig: { hostUri: '192.168.1.5:8081' } } }), fixture.expected);
}
console.log('PASS hierarchy matching, different neon colors, one interior count tag per area, hole avoidance, boundary/tag clicks, cleanup, native script syntax and escaped labels');
}
main().catch(error => { console.error(error);process.exitCode = 1; });
