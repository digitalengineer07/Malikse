export type MapPoint = { lat: number; lng: number };
export type MapPin = MapPoint & { id: string; label: string; title: string };
export type MapFocus = MapPoint & { zoom: number };
export type NativeMapOptions = { pins?: MapPin[]; points?: MapPoint[]; editable?: boolean; focus?: MapFocus };

export function validMapPoint(point: MapPoint): boolean {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** Only JSON data enters the script; labels are rendered through textContent. */
export function nativeMapHtml(options: NativeMapOptions): string {
  const data = JSON.stringify({ ...options, pins: (options.pins ?? []).filter(validMapPoint), points: (options.points ?? []).filter(validMapPoint) }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
html,body,#map{height:100%;width:100%;margin:0}body{background:#E9F3FA;font-family:Arial,sans-serif}.price{display:inline-block;background:#1A365D;color:white;padding:8px 12px;border:2px solid white;border-radius:22px;font-size:13px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 5px #0003}.vertex{background:#fff;border:3px solid #059669;border-radius:50%;box-sizing:border-box}.tools{position:absolute;bottom:25px;left:10px;right:10px;z-index:1000;display:flex;gap:8px;justify-content:center}.tools button{min-height:44px;padding:8px 16px;background:white;border:1px solid #cbd5e1;border-radius:12px;color:#19334a;font-weight:bold}.tools button:disabled{opacity:.5}.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="map" aria-label="Property map"></div><script>
function send(type,payload){window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type,payload}));}
</script><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="send('error')"></script><script>
try {
const data=${data};
const map=L.map('map',{scrollWheelZoom:false,zoomControl:false}).setView([25.6,85.1],7);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
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
data.pins.forEach(pin=>{
 const label=document.createElement('div');label.className='price';label.textContent=pin.label;
 L.marker([pin.lat,pin.lng],{title:pin.title,icon:L.divIcon({html:label,className:'',iconSize:[90,40],iconAnchor:[45,40]})}).addTo(map).on('click',()=>send('select',pin.id));
 bounds.push([pin.lat,pin.lng]);
});
points.forEach(p=>bounds.push([p.lat,p.lng]));
if(data.focus && Number.isFinite(data.focus.lat) && Number.isFinite(data.focus.lng) && Math.abs(data.focus.lat)<=90 && Math.abs(data.focus.lng)<=180 && Number.isFinite(data.focus.zoom))map.setView([data.focus.lat,data.focus.lng],Math.max(1,Math.min(19,data.focus.zoom)));
else if(bounds.length)map.fitBounds(bounds,{padding:[50,50],maxZoom:points.length?18:14});
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
window.addEventListener('resize',()=>map.invalidateSize());
} catch(error){send('error');}
</script></body></html>`;
}
