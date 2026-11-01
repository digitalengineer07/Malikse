const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
// Evaluate the actual generated HTML, including the serialized Places SDK.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { nativeMapHtml } = require('../src/utils/nativeMapHtml.ts');
const messages = [], tiles = [], markers = [], controls = [];
const element = () => ({ style: {}, appendChild() {}, remove() {}, textContent: '', onclick: undefined });
const map = { setView() { return this; }, removeLayer() {}, zoomIn() {}, zoomOut() {}, on() {}, fitBounds() {}, invalidateSize() {} };
const layer = () => ({ addTo() { return this; }, clearLayers() {} });
const context = {
  console, setTimeout, clearTimeout,
  window: { ReactNativeWebView: { postMessage: text => messages.push(JSON.parse(text)) }, addEventListener() {} },
  document: { createElement: tag => { const el = element(); if (tag === 'button') controls.push(el); return el; }, body: element() },
  L: {
    map: () => map,
    tileLayer: url => { tiles.push(url); return { addTo() { return this; }, on() {} }; },
    layerGroup: layer,
    divIcon: options => options,
    marker: (point, options) => { const marker = { point, options, addTo() { return this; }, on(name, callback) { this[name] = callback; return this; } }; markers.push(marker); return marker; },
    polygon: () => ({ addTo() { return this; }, on() { return this; } }),
  },
};
const html = nativeMapHtml({ marketplace: true, regions: { groups: [], level: 'district', state: 'Bihar' }, pins: [
  { id: 'property:1', lat: 25.6, lng: 85.1, title: '</script><script>bad()</script>', label: '₹25 L' },
], focus: { lat: 25.65, lng: 85.35, zoom: 7.5 } });
vm.createContext(context);
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]).runInContext(context);
assert(messages.some(m => m.type === 'ready'));
assert(!messages.some(m => m.type === 'error'));
assert(tiles[0].includes('lyrs=m'));
assert.equal(markers.length, 1);
markers[0].click();
assert(messages.some(m => m.type === 'select' && m.payload === 'property:1'));
controls.find(b => b.textContent === 'Satellite').onclick();
assert(tiles.at(-1).includes('lyrs='));
assert.equal(controls.at(-1).textContent, 'Street');
context.window.updatePropertyData([{ id: 'property:2', lat: 25, lng: 85, label: '₹30 L', title: 'Updated' }], []);
assert.equal(markers.at(-1).options.title, 'Updated');
for (const options of [{}, { editable: true }, { pins: [], satellite: true }]) {
  for (const match of nativeMapHtml(options).matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
}
console.log('Marketplace map checks passed: HTML safety, bridge selection, live marker updates, layers, and existing map modes.');

(async () => {
  context.window.google = { maps: {
    Map: function () {},
    Geocoder: class { geocode(query, callback) { callback([{ geometry: { location: { lat: () => 25.6, lng: () => 85.1 } }, formatted_address: 'Patna, Bihar' }], 'OK'); } },
  } };
  await context.window.runPlaceRequest({ id: 7, method: 'geocodeAddress', value: 'Patna' });
  const result = messages.find(message => message.type === 'placeResult' && message.payload.id === 7);
  assert.equal(result.payload.result.lat, 25.6);
  const bridge = require('../src/utils/nativePlacesBridge.ts');
  const pending = bridge.requestPlaceService('geocodePlaceId', 'place-1', null);
  let request;
  const detach = bridge.attachPlacesTransport(value => { request = value; });
  assert.equal(request.value, 'place-1');
  bridge.receivePlaceResult(request.id, { lat: 25.6, lng: 85.1 });
  assert.deepEqual(await pending, { lat: 25.6, lng: 85.1 });
  detach();
  console.log('Places bridge checks passed: queued request, SDK geocoding, and response delivery.');
})().catch(error => { console.error(error); process.exitCode = 1; });

const cachedHtml = nativeMapHtml({ regions: { groups: [], level: 'district', state: 'Bihar' } }, {
  leafletJs: fs.readFileSync(require.resolve('leaflet/dist/leaflet.js'), 'utf8'),
  leafletCss: fs.readFileSync(require.resolve('leaflet/dist/leaflet.css'), 'utf8'),
  vectorGridJs: fs.readFileSync(require.resolve('leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.min.js'), 'utf8'),
});
assert(!cachedHtml.includes('<script src='), 'cached maps must not download their libraries again');
for (const match of cachedHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
console.log('Cached map HTML includes valid inline libraries without CDN script downloads.');
