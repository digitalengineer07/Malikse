const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const timers = new Map();
let nextTimer = 0;
const clock = { setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); } };
const source = fs.readFileSync(require.resolve('leaflet/src/map/handler/Map.ScrollWheelZoom.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export var ScrollWheelZoom', 'var ScrollWheelZoom');
const context = { ...clock, Map: { mergeOptions() {}, addInitHook() {} }, Handler: { extend: x => x }, DomEvent: { on() {}, off() {}, getWheelDelta: () => 60, stop() {} }, Util: { bind: (fn, self) => fn.bind(self) } };
vm.createContext(context);
vm.runInContext(source, context);
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/removeLeafletMap.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, ...clock });
function fixture() {
 let removed = false, zooms = 0;
 const map = { options: { wheelDebounceTime: 40, zoomSnap: 1, wheelPxPerZoomLevel: 60 }, mouseEventToContainerPoint: () => ({}), getZoom: () => 5, _stop() {}, _limitZoom: x => x, setZoomAround() { if (removed) throw new Error('removed pane'); zooms++; }, remove() { this.scrollWheelZoom.disable(); removed = true; } };
 const wheel = Object.assign(Object.create(context.ScrollWheelZoom), { _map: map, disable() { this.removeHooks(); } });
 map.scrollWheelZoom = wheel; wheel.addHooks(); wheel._onWheelScroll({});
 return { map, zooms: () => zooms };
}
function flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }
const baseline = fixture(); baseline.map.remove(); assert.throws(flush, /removed pane/);
const fixed = fixture(); exportsObject.removeLeafletMap(fixed.map); assert.equal(timers.size, 0); flush(); assert.equal(fixed.zooms(), 0);
const live = fixture(); flush(); assert.equal(live.zooms(), 1);
exportsObject.removeLeafletMap(null); exportsObject.removeLeafletMap(undefined);
console.log('PASS: reproduced stale wheel zoom; cleanup cancels it; live zoom still works.');
