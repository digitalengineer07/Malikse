import type { RegionBoundaryOptions } from "./regionBoundaryLayer";
import { regionBoundaryScript } from "./regionBoundaryScript";
import { parcelTileUrl } from "./parcelMap";
import { googlePlacesScript } from "./googlePlacesScript";
export type MapPoint = { lat: number; lng: number };
export type NativeMapAssets = { leafletJs: string; leafletCss: string; vectorGridJs: string };
export type MapPin = MapPoint & { id: string; label: string; title: string; photo?: string; area?: string; location?: string };
export type MapFocus = MapPoint & { zoom: number };
export type NativeMapOptions = { pins?: MapPin[]; points?: MapPoint[]; parcels?: { id: string; points: MapPoint[] }[]; satellite?: boolean; editable?: boolean; marketplace?: boolean; focus?: MapFocus; regions?: RegionBoundaryOptions };

export function validMapPoint(point: MapPoint): boolean {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** Only JSON data enters the script; labels are rendered through textContent. */
export function nativeMapHtml(options: NativeMapOptions, assets?: NativeMapAssets): string {
  const data = JSON.stringify({ ...options, pins: (options.pins ?? []).filter(validMapPoint), points: (options.points ?? []).filter(validMapPoint) }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const inlineScript = (source: string) => `<script>${source.replace(/<\/script/gi, "<\\/script")}\n</script>`;
  const css = assets ? `<style>${assets.leafletCss.replace(/<\/style/gi, "<\\/style").replace(/url\(images\//g, "url(https://unpkg.com/leaflet@1.9.4/dist/images/")}</style>` : '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">';
  const leaflet = assets ? inlineScript(assets.leafletJs) : '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="send(\'error\')"></script>';
  const vectorGrid = !options.regions ? "" : assets ? inlineScript(assets.vectorGridJs) : '<script src="https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js" onerror="send(\'boundaryError\')"></script>';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">${css}<style>
html,body,#map{height:100%;width:100%;margin:0}body{background:#E9F3FA;font-family:Arial,sans-serif}.price{display:inline-block;background:#1A365D;color:white;padding:8px 12px;border:2px solid white;border-radius:22px;font-size:13px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 5px #0003}.vertex{background:#fff;border:3px solid #059669;border-radius:50%;box-sizing:border-box}.tools{position:absolute;bottom:25px;left:10px;right:10px;z-index:1000;display:flex;gap:8px;justify-content:center}.tools button{min-height:44px;padding:8px 16px;background:white;border:1px solid #cbd5e1;border-radius:12px;color:#19334a;font-weight:bold}.tools button:disabled{opacity:.5}.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="map" aria-label="Property map"></div><script>
function send(type,payload){window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type,payload}));}
</script>${leaflet}${vectorGrid}<script>
try {
const data=${data};
const map=L.map('map',{scrollWheelZoom:false,zoomControl:false,...(data.marketplace?{minZoom:3.8,maxZoom:18,maxBounds:[[4,64],[39,101]]}:{})}).setView([25.6,85.1],7);
window.focusMap=(lat,lng,zoom)=>map.setView([lat,lng],zoom);
let tiles;
function setLayer(satellite){
 if(tiles)map.removeLayer(tiles);
 tiles=L.tileLayer(satellite ? (data.marketplace ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' : ${JSON.stringify(parcelTileUrl)}) : data.marketplace ? 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{subdomains:'0123',maxZoom:19,attribution:satellite || data.marketplace ? 'Map data &copy; <a href="https://maps.google.com">Google</a>' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
}
setLayer(!!data.satellite);
let loaded=false;
tiles.on('tileload',()=>{if(!loaded){loaded=true;send('ready');}});
let points=data.points.slice(),closed=points.length>=3;
const parcel=L.layerGroup().addTo(map);
let undoButton,clearButton,finishButton;
function draw(){
 parcel.clearLayers();
 if(points.length>=2){const coordinates=points.map(p=>[p.lat,p.lng]);(closed?L.polygon(coordinates,{color:'#059669',fillOpacity:.25}):L.polyline(coordinates,{color:'#059669'})).addTo(parcel);}
 points.forEach((p,i)=>{
  const marker=L.marker([p.lat,p.lng],{draggable:!!data.editable,icon:L.divIcon({className:'vertex',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(parcel);
  marker.on('dragend',()=>{const p=marker.getLatLng();points[i]={lat:p.lat,lng:p.lng};draw();send('points',points);});
 });
 if(undoButton){undoButton.disabled=!points.length;clearButton.disabled=!points.length;finishButton.disabled=points.length<3||closed;}
}
const bounds=[];
const propertyLayer=L.layerGroup().addTo(map);
function updateProperties(pins,parcels){
propertyLayer.clearLayers();
bounds.length=0;
(parcels || []).forEach(parcel=>{
 const coordinates=parcel.points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180).map(p=>[p.lat,p.lng]);
 if(coordinates.length<3)return;
 L.polygon(coordinates,{color:data.marketplace?'#0284C7':'#10B981',weight:2.5,fillColor:data.marketplace?'#38BDF8':'#059669',fillOpacity:.25}).addTo(propertyLayer).on('click',()=>send('select',parcel.id));
 coordinates.forEach(p=>bounds.push(p));
});
pins.forEach(pin=>{
 const label=document.createElement('div');label.className='price';label.textContent=pin.label;
 const marker=L.marker([pin.lat,pin.lng],{title:pin.title,icon:L.divIcon({html:label,className:'',iconSize:[90,40],iconAnchor:[45,40]})}).addTo(propertyLayer);
 marker.on('click',()=>send('select',pin.id));
 bounds.push([pin.lat,pin.lng]);
});
}
window.updatePropertyData=(pins,parcels)=>updateProperties(pins,parcels);
updateProperties(data.pins,data.parcels);
${options.regions ? `let removeRegions;
window.updateRegions = regions => {
 if(removeRegions) { removeRegions(); removeRegions=undefined; }
 if(!regions.groups.length)return;
 try { removeRegions=(${regionBoundaryScript})(L,map,regions,key=>send('select',key),()=>send('boundaryError')); } catch(error) { send('boundaryError'); }
};
window.updateRegions(data.regions);` : ""}
${options.marketplace ? `
const places=(${googlePlacesScript})({env:{EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:${JSON.stringify(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").replace(/</g, "\\u003c")}}});
window.runPlaceRequest=async request=>{
 if(!['fetchGooglePlaceSuggestions','geocodePlaceId','geocodeAddress'].includes(request.method))return;
 try{send('placeResult',{id:request.id,result:await places[request.method](request.value)});}
 catch(error){send('placeResult',{id:request.id,result:null});}
};
const controls=document.createElement('div');controls.className='tools';controls.style.cssText='top:12px;bottom:auto;left:auto;right:12px;flex-direction:column';
function control(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;controls.appendChild(b);return b;}
control('+',()=>map.zoomIn());control('−',()=>map.zoomOut());
control('Reset',()=>map.setView([25.65,85.35],7.5));
control('Near me',()=>send('locate'));
let satellite=false;
const layerButton=control('Satellite',()=>{satellite=!satellite;setLayer(satellite);layerButton.textContent=satellite?'Street':'Satellite';});
document.body.appendChild(controls);
` : ""}
points.forEach(p=>bounds.push([p.lat,p.lng]));
if(data.focus && Number.isFinite(data.focus.lat) && Number.isFinite(data.focus.lng) && Math.abs(data.focus.lat)<=90 && Math.abs(data.focus.lng)<=180 && Number.isFinite(data.focus.zoom))map.setView([data.focus.lat,data.focus.lng],Math.max(1,Math.min(19,data.focus.zoom)));
else if(bounds.length)map.fitBounds(bounds,{padding:[50,50],maxZoom:points.length || data.parcels?.length ?18:14});
if(data.editable){
 const tools=document.createElement('div');tools.className='tools';
 function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;tools.appendChild(b);return b;}
 undoButton=button('Undo',()=>{points.pop();closed=false;draw();send('points',points);});
 clearButton=button('Clear',()=>{points=[];closed=false;draw();send('points',points);});
 finishButton=button('Finish',()=>{closed=true;draw();send('points',points);});
 document.body.appendChild(tools);
 map.on('click',e=>{if(closed)return;points.push({lat:e.latlng.lat,lng:e.latlng.lng});draw();send('points',points);});
}
draw();
// The controls are usable before slow tile servers deliver their first image.
send('ready');
window.addEventListener('resize',()=>map.invalidateSize());
} catch(error){send('error');}
</script></body></html>`;
}
