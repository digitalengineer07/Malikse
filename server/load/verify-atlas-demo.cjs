const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
process.env.NODE_ENV='development';process.env.JWT_ACCESS_SECRET=randomUUID();process.env.JWT_REFRESH_SECRET=randomUUID();
const mongoose=require('mongoose');
const {createApp}=require('../dist/app');
const uri=process.env.TARGET_DEMO_MONGO_URI;
if(!uri||!uri.startsWith('mongodb+srv://')||new URL(uri).pathname!=='/MAlikse')throw Error('Expected the authorized Atlas MAlikse database');
let server;
async function main(){
  await mongoose.connect(uri,{maxPoolSize:10,serverSelectionTimeoutMS:15000});
  const db=mongoose.connection.db;
  const owner=await db.collection('users').findOne({email:'demo-properties@malikse.invalid',role:'user'});assert.ok(owner);
  const rows=await db.collection('properties').find({ownerId:owner._id,title:/^DEMO · /}).toArray();
  assert.equal(rows.length,150);assert.equal(new Set(rows.map(row=>row.title)).size,150);
  const filenames=new Set(rows.flatMap(row=>(row.media?.photos||[]).map(url=>new URL(url).pathname.split('/').at(-1))));
  assert.equal(filenames.size,6);
  for(const row of rows){assert.equal(row.parcelPoints?.length,4);assert.equal(row.status,'verified');assert.equal(row.badges?.fullyVerified,true);}
  const state=await db.collection('regioncountstates').findOne({_id:'public-regions-v1'});
  assert.ok(state?.generation);assert.equal(state.revision,state.builtRevision);
  const totals=await db.collection('regioncounts').find({generation:state.generation,level:'state',propertyType:'all'}).toArray();
  const totalPublished=totals.reduce((sum,row)=>sum+row.count,0);
  assert.ok(totalPublished>=150,'Stored state totals must include all 150 demo listings');
  const demoByState=new Map();for(const row of rows)demoByState.set(row.location.state,(demoByState.get(row.location.state)||0)+1);
  for(const [name,count] of demoByState)assert.ok((totals.find(row=>row.key===name)?.count||0)>=count,`Missing ${name} demo counts`);
  server=createApp().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const checks=[['Bihar','Patna','800001'],['Bihar','Gaya','823001'],['Maharashtra','Pune','411045'],['Karnataka','Bengaluru','560066']];
  for(const [region,district,pincode] of checks){
    const path='/properties/search?view=cards&state='+encodeURIComponent(region)+'&district='+encodeURIComponent(district)+'&pincode='+pincode;
    const response=await fetch(base+path);assert.equal(response.status,200);assert.ok((await response.json()).some(row=>row.location.pincode===pincode));
  }
  const regionResponse=await fetch(base+'/properties/regions');assert.equal(regionResponse.status,200);
  const groups=(await regionResponse.json()).groups;assert.equal(groups.reduce((sum,row)=>sum+row.count,0),totalPublished);
  const sample=rows[0],filename=new URL(sample.media.photos[0]).pathname.split('/').at(-1);
  const photo=await fetch(base+'/property-photos/'+filename);assert.equal(photo.status,200);assert.ok((await photo.arrayBuffer()).byteLength>10000);
  const detail=await fetch(base+'/properties/'+sample._id);assert.equal(detail.status,200);assert.equal((await detail.json()).parcelPoints.length,4);
  console.log(`PASS Atlas: 150 published demo listings, 150 boundaries, 6 GridFS photo references, ${totalPublished} total published listings including pre-existing records, public search, photo and detail HTTP routes`);
}
main().catch(error=>{console.error('Atlas verification failed:',error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi,'mongodb+srv://[redacted]@'));process.exitCode=1;}).finally(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await mongoose.disconnect();});
