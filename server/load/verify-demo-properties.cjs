const assert=require('assert/strict');
const mongoose=require('mongoose');
require('dotenv').config();
const {User}=require('../dist/models/User.model');
const {Property}=require('../dist/models/Property.model');
const {createApp}=require('../dist/app');
const {mongoPoolOptions}=require('../dist/services/mongoPool');
const checks=[['Bihar','Patna','800001'],['Bihar','Patna','801503'],['Bihar','Patna','800014'],['Bihar','Gaya','823001'],['Maharashtra','Pune','411045'],['Karnataka','Bengaluru','560066']];
let server;
async function main(){
  const uri=process.env.MONGO_URI||'mongodb://localhost:27017/malikse';
  const endpoint=new URL(uri);
  assert.ok(endpoint.protocol==='mongodb:'&&['localhost','127.0.0.1'].includes(endpoint.hostname)&&endpoint.pathname==='/malikse');
  await mongoose.connect(uri,{autoIndex:false,...mongoPoolOptions()});
  const owner=await User.findOne({email:'demo-properties@malikse.invalid',role:'user'}).lean();assert.ok(owner);
  const records=await Property.find({ownerId:owner._id,title:/^DEMO · /}).lean();assert.equal(records.length,150);
  assert.deepEqual([...new Set(records.map(row=>row.title))].length,150);
  const states=new Set(),types=new Set(),districts=new Set(),pincodes=new Set(),photoFiles=new Set();
  for(const record of records){
    assert.equal(record.parcelPoints.length,4);
    assert.equal(record.status,'verified');
    assert.ok(record.description.includes('SAMPLE DATA ONLY'));
    assert.match(record.location.pincode,/^[1-9]\d{5}$/);
    assert.ok(record.media.photos.length);
    states.add(record.location.state);types.add(record.type);districts.add(record.location.state+'/'+record.location.district);pincodes.add(record.location.pincode);
    photoFiles.add(new URL(record.media.photos[0]).pathname.split('/').at(-1));
  }
  assert.equal(states.size,7);assert.equal(types.size,5);assert.equal(photoFiles.size,6);
  const bucket=new mongoose.mongo.GridFSBucket(mongoose.connection.db,{bucketName:'photos'});
  server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  for(const [state,district,pincode] of checks){
    const record=records.find(row=>row.location.state===state&&row.location.district===district&&row.location.pincode===pincode);
    assert.ok(record,`missing ${state}/${district}/${pincode}`);
    assert.equal(record.parcelPoints.length,4);
    assert.equal(record.status,'verified');
    assert.ok(record.description.includes('SAMPLE DATA ONLY'));
    const url=new URL(record.media.photos[0]);const filename=url.pathname.split('/').at(-1);
    assert.equal(url.origin,'http://localhost:5000');
    assert.ok(await bucket.find({filename}).next(),`missing GridFS photo ${filename}`);
    const photo=await fetch(base+url.pathname);assert.equal(photo.status,200);assert.match(photo.headers.get('content-type'),/image\/jpeg/);assert.ok((await photo.arrayBuffer()).byteLength>10000);
    const search=await fetch(base+'/properties/search?view=cards&state='+encodeURIComponent(state)+'&district='+encodeURIComponent(district)+'&pincode='+pincode);
    assert.equal(search.status,200);assert.ok((await search.json()).some(row=>row._id===String(record._id)));
    const detail=await fetch(base+'/properties/'+record._id);assert.equal(detail.status,200);assert.equal((await detail.json()).parcelPoints.length,4);
  }
  for(const state of states){
    const result=await fetch(base+'/properties/regions');assert.equal(result.status,200);
    assert.ok((await result.json()).groups.some(group=>group.key===state));
  }
  let cursor,seen=[],pageCount=0;
  do {
    const route=base+'/properties/search?view=cards&limit=20&state=Bihar&district=Patna&pincode=800001'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    const response=await fetch(route);assert.equal(response.status,200);
    seen.push(...(await response.json()).filter(row=>row.title?.startsWith('DEMO · ')).map(row=>row._id));
    cursor=response.headers.get('x-next-cursor');pageCount++;
    assert.ok(pageCount<=10,'pagination must terminate');
  }while(cursor);
  assert.equal(pageCount,3);assert.equal(seen.length,57);assert.equal(new Set(seen).size,57);
  console.log('PASS 150 public demo listings across '+states.size+' states, '+districts.size+' state/district pairs, '+pincodes.size+' pincodes and '+types.size+' types; six GridFS images, HTTP photos/details, 4-point boundaries and 3 cursor pages');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await mongoose.disconnect();});
