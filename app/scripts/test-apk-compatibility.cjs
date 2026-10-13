const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require('./generate-native-map.cjs');
function load(file, mocks = {}) {
  const filename = path.resolve(root, file);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, FormData: mocks.FormData, require: name => {
    if (name in mocks) return mocks[name];
    return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks);
  } });
  return exports;
}
async function main() {
  let nativeScreens = 0;
  for (const directory of ['app', 'components']) {
    for (const relative of fs.readdirSync(path.join(root, directory), { recursive: true })) {
      if (!relative.endsWith('.tsx') || /\.(web|ios)\.tsx$/.test(relative)) continue;
      const filename = path.join(root, directory, relative);
      if (fs.existsSync(filename.replace(/\.tsx$/, '.native.tsx')) || fs.existsSync(filename.replace(/\.tsx$/, '.android.tsx'))) continue;
      const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(ast);
          assert.ok(!/^[a-z][a-z0-9-]*$/.test(tag), `${filename} contains browser-only JSX: ${tag}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast); nativeScreens++;
    }
  }
  const { normalizePropertyMedia } = load('src/utils/propertyMedia.ts');
  const property = { media: { photos: ['http://malikse.onrender.com/a.jpg', 'https://other.example/a.jpg', 'http://malikse.onrender.com.evil/a.jpg'], videos: ['http://malikse.onrender.com/a.mp4'] } };
  normalizePropertyMedia(property);
  assert.equal(property.media.photos[0], 'https://malikse.onrender.com/a.jpg');
  assert.equal(property.media.photos[1], 'https://other.example/a.jpg');
  assert.equal(property.media.photos[2], 'http://malikse.onrender.com.evil/a.jpg');
  assert.equal(property.media.videos[0], 'https://malikse.onrender.com/a.mp4');
  for (const platform of ['android', 'web']) {
    let body;
    const api = { post: async (_url, value) => { body = value; return { data: {} }; } };
    class FormData { parts = []; append(...args) { this.parts.push(args); } }
    const mocks = { './authService': { __esModule: true, default: api }, 'react-native': { Platform: { OS: platform } }, './searchCache': {}, FormData };
    const photo = { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' };
    await load('src/services/propertyService.ts', mocks).propertyService.uploadPhoto('p1', photo, 'photo.jpg');
    assert.equal(body.parts[0][1], photo);
    assert.equal(body.parts[0].length, platform === 'android' ? 2 : 3);
    await load('src/services/documentService.ts', mocks).documentService.uploadDocument('p1', 'Registry', photo, 'photo.jpg');
    assert.equal(body.parts.find(part => part[0] === 'file').length, platform === 'android' ? 2 : 3);
  }
  // Execute the embedded map as a WebView would; focus must not clear a drawn parcel.
  const { nativeMapHtml } = load('src/utils/nativeMapHtml.ts');
  const messages = [], polygons = [], views = [], tileUrls = [];
  const map = { setView(...args) { views.push(args); return this; }, fitBounds() {}, on() {}, invalidateSize() {} };
  const element = () => ({ appendChild() {}, style: {} });
  const L = {
    map: () => map,
    tileLayer: url => { tileUrls.push(url); return { addTo() { return this; }, on(event, cb) { if (event === 'tileload') cb(); } }; },
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {} }),
    polygon: coords => { polygons.push(coords); return { addTo() { return this; }, on() {} }; },
    marker: () => ({ addTo() { return this; }, on() {} }), divIcon: value => value,
  };
  const window = { ReactNativeWebView: { postMessage: message => messages.push(JSON.parse(message)) }, addEventListener() {} };
  const html = nativeMapHtml({ satellite: true, parcels: [{ id: 'p1', points: [{ lat: 25, lng: 85 }, { lat: 26, lng: 85 }, { lat: 26, lng: 86 }] }] });
  const context = vm.createContext({ L, window, document: { createElement: element } });
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  assert.ok(messages.some(message => message.type === 'ready'));
  assert.ok(!messages.some(message => message.type === 'error'));
  assert.equal(polygons.length, 1);
  assert.ok(tileUrls[0].includes('lyrs=s'));
  window.focusMap(27, 86, 16);
  assert.equal(views.at(-1)[1], 16);
  assert.equal(polygons.length, 1, 'Changing focus must not recreate parcel geometry');
  console.log(`PASS ${nativeScreens} native route/component JSX checks, native/web uploads, secure media URLs, satellite tiles, parcel rendering and map focus`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
