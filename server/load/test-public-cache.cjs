const assert = require('assert/strict');
const { randomUUID } = require('crypto');
const http = require('http');
const zlib = require('zlib');
process.env.NODE_ENV='development'; process.env.REQUEST_LOGS='false';
process.env.JWT_ACCESS_SECRET=randomUUID(); process.env.JWT_REFRESH_SECRET=randomUUID();
process.env.PUBLIC_RESPONSE_CACHE_ENABLED='true';
process.env.PUBLIC_JSON_COMPRESSION='true';
process.env.REDIS_URL='redis://127.0.0.1:1'; // Real connection refusal exercises fallback.
const mongoose = require('mongoose');
const { createFastifyApp } = require('../dist/fastifyApp');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { getPublicSearchResponse } = require('../dist/services/propertySearch');
const { publicResponse } = require('../dist/services/publicResponseCache');
const { beginPublicMutation, publicGeneration } = require('../dist/services/publicCacheGeneration');
const { searchMemory } = require('../dist/services/searchMemory');
const { admitPublicRead } = require('../dist/services/publicReadAdmission');
const { stopRegionCounts } = require('../dist/services/regionCountStore');
const redis = require('../dist/services/redis');
const db='malikse_cache_test_'+randomUUID().replaceAll('-','');
let app,server, base, commands=0;
function raw(route, encoding, method = 'GET') {
  return new Promise((resolve,reject)=>{
    http.get(base+route,{method,headers:encoding ? {'Accept-Encoding':encoding} : {}},res=>{
      const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    }).on('error',reject);
  });
}
async function main() {
  // Region rebuilds invalidate all public snapshots asynchronously. This suite
  // controls invalidation explicitly; the region worker has its own integration suite.
  await stopRegionCounts();
  await mongoose.connect('mongodb://127.0.0.1:27017/'+db,{monitorCommands:true});
  mongoose.connection.getClient().on('commandStarted',e=>{if(['find','aggregate','count'].includes(e.commandName))commands++;});
  const [owner,hidden]=await User.create([{name:'Owner',mobile:'9200090001',role:'user'}, {name:'Hidden',mobile:'9200090002',role:'user',isSuspended:true}]);
  const fixture={ownerId:owner._id,title:'A public listing',type:'land',location:{state:'Bihar',district:'Patna',lat:25,lng:85},price:100000,totalArea:1000,sellableArea:900,status:'verified',badges:{fullyVerified:true},advisorReview:{decision:'approve'},verifierReview:{decision:'approve'},media:{photos:['https://example.test/1.jpg','https://example.test/2.jpg']}};
  fixture.description='Detailed property description. '.repeat(100);
  fixture.parcelPoints=[{lat:25,lng:85},{lat:25.1,lng:85.1},{lat:25.2,lng:85.2}];
  fixture.media.videos=['https://example.test/tour.mp4'];
  const rows=await Property.insertMany(Array.from({length:240},(_,i)=>({...fixture,title:'Listing '+i,type:i>=130?'shop':'land',ownerId:i>=130?hidden._id:owner._id})));
  await Property.createIndexes();
  app=createFastifyApp();await app.listen({port:0,host:'127.0.0.1'});server=app.server;base='http://127.0.0.1:'+server.address().port;
  const admin=await User.create({name:'Admin',mobile:'9200090003',role:'admin',passwordHash:'test-fixture-only'});
  const staff=await User.create({name:'Staff',mobile:'9200090004',role:'advisor',passwordHash:'test-fixture-only'});
  const token=require('jsonwebtoken').sign({id:String(admin._id),role:'admin'},process.env.JWT_ACCESS_SECRET);
  async function setState(path, body) {
    const response=await fetch(base+path,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,200);return response.json();
  }
  for(let i=0;i<2;i++) assert.equal((await setState('/admin/users/'+owner._id+'/suspend',{isSuspended:true})).isSuspended,true);
  await setState('/admin/users/'+owner._id+'/suspend',{isSuspended:false});
  for(let i=0;i<2;i++) assert.equal((await setState('/admin/staff/'+staff._id+'/status',{isActive:false})).isActive,false);
  await setState('/admin/staff/'+staff._id+'/status',{isActive:true});
  console.log('PASS repeated desired-state admin requests remain idempotent');
  const defaults=await raw('/properties/search');
  const cards=JSON.parse(defaults.body);
  assert.equal(defaults.status,200);assert.equal(cards.length,100);
  assert.equal(defaults.headers['content-encoding'],undefined);
  assert.ok(defaults.headers['x-next-cursor']);
  assert.deepEqual(defaults.body,(await raw('/properties/search?view=cards','identity')).body);
  for(const card of cards) {
    for(const field of ['description','parcelPoints','disclosures','ownerId','verificationHistory']) assert.equal(card[field],undefined);
    assert.deepEqual(card.media,{photos:[fixture.media.photos[0]]});
  }
  const full=await raw('/properties/search?view=full','identity');
  const fullRows=JSON.parse(full.body);
  assert.equal(full.status,200);assert.equal(fullRows.length,100);
  assert.deepEqual(cards.map(p=>p._id),fullRows.map(p=>p._id));
  assert.equal(fullRows[0].description,fixture.description);
  assert.equal(fullRows[0].parcelPoints.length,3);
  assert.deepEqual(fullRows[0].media.photos,fixture.media.photos);
  assert.deepEqual(fullRows[0].media.videos,fixture.media.videos);
  assert.ok(defaults.body.length < full.body.length / 2);
  console.log('PASS compact default, unchanged page size, explicit full view', {cards:defaults.body.length,full:full.body.length});
  const coldBefore=commands;
  const cold=await raw('/properties/search?type=land','gzip');
  assert.equal(cold.status,200);
  const coldRows=JSON.parse(zlib.gunzipSync(cold.body));
  assert.equal(coldRows.length,100);assert.ok(cold.headers['x-next-cursor']);
  assert.equal(commands-coldBefore,2,'a cold 100-result page should use one property read and one owner read');
  const tail=await raw('/properties/search?type=land&cursor='+encodeURIComponent(cold.headers['x-next-cursor']),'gzip');
  const tailRows=JSON.parse(zlib.gunzipSync(tail.body));
  assert.equal(tailRows.length,30);assert.equal(tail.headers['x-next-cursor'],'');
  assert.equal(new Set([...coldRows,...tailRows].map(p=>p._id)).size,130);
  console.log('PASS cold default page uses two database reads with complete cursor traversal');
  const route='/properties/search?view=cards&limit=50';
  const identity=await raw(route,'identity');assert.equal(identity.status,200);assert.equal(JSON.parse(identity.body).length,50);
  const before=commands;
  const gz=await raw(route,'gzip'),br=await raw(route,'br');
  assert.equal(commands,before,'warm HTTP cache hits must make zero Mongo reads');
  assert.deepEqual(zlib.gunzipSync(gz.body),identity.body);assert.deepEqual(zlib.brotliDecompressSync(br.body),identity.body);
  for(const [response,encoding] of [[gz,'gzip'],[br,'br']]) {
    assert.equal(response.headers['content-encoding'],encoding);
    assert.equal(Number(response.headers['content-length']),response.body.length);
    const head=await raw(route,encoding,'HEAD');
    assert.equal(head.status,200);assert.equal(head.body.length,0);
    assert.equal(head.headers['content-encoding'],encoding);
    assert.equal(head.headers['content-length'],response.headers['content-length']);
  }
  assert.equal((await raw(route,'br;q=0, gzip;q=1, identity;q=0')).headers['content-encoding'],'gzip');
  assert.equal(gz.headers['x-next-cursor'],identity.headers['x-next-cursor']);assert.match(gz.headers.vary,/Accept-Encoding/);
  assert.equal((await raw(route,'identity;q=0, gzip;q=0, br;q=0')).status,406);
  assert.ok(gz.body.length<identity.body.length);assert.equal(JSON.parse(identity.body)[0].media.photos.length,1);
  console.log('PASS compression, cursor headers, Redis connection-failure fallback and zero-DB warm reads', {identity:identity.body.length,gzip:gz.body.length,brotli:br.body.length});
  let cursor, seen=[];
  do {const response=await raw(route+(cursor?'&cursor='+encodeURIComponent(cursor):''),'identity');assert.equal(response.status,200);seen.push(...JSON.parse(response.body).map(p=>p._id));cursor=response.headers['x-next-cursor'];}while(cursor);
  assert.equal(seen.length,130);assert.equal(new Set(seen).size,130,'suspended-owner batches must not skip active listings');
  const detail='/properties/'+rows[0]._id;
  assert.equal((await raw(detail,'identity')).status,200);
  await User.updateOne({_id:owner._id},{$set:{isSuspended:true}});
  assert.equal(JSON.parse((await raw(route,'identity')).body).length,0);assert.equal((await raw(detail,'identity')).status,404);
  await User.updateOne({_id:owner._id},{$set:{isSuspended:false}});
  await Property.updateOne({_id:rows[0]._id},{$set:{price:222222}});
  assert.equal(JSON.parse((await raw(detail,'identity')).body).price,222222);
  await Property.bulkWrite([{updateOne:{filter:{_id:rows[0]._id},update:{$set:{price:333333}}}}]);
  assert.equal(JSON.parse((await raw(detail,'identity')).body).price,333333);
  await Property.updateOne({_id:rows[0]._id},{$set:{status:'sold'}});assert.equal((await raw(detail,'identity')).status,404);
  await assert.rejects(Property.updateOne({_id:'invalid'},{$set:{price:1}}));publicGeneration();
  await assert.rejects(User.create({name:'duplicate',mobile:owner.mobile,role:'user'}));publicGeneration();
  await assert.rejects(Property.insertMany([{...fixture,type:'invalid'}]));publicGeneration();
  const absent=new mongoose.Types.ObjectId();
  assert.equal((await raw('/properties/'+absent,'identity')).status,404);
  await Property.create({...fixture,_id:absent});
  assert.equal((await raw('/properties/'+absent,'identity')).status,200,'negative cache must not hide a new property');
  await Property.deleteOne({_id:absent});
  assert.equal((await raw('/properties/'+absent,'identity')).status,404);
  console.log('PASS complete paging, suspension, reactivation, updated fields, unpublication and failed-write barrier release');
  let release, started;
  const entered=new Promise(r=>started=r);
  const fill=publicResponse({race:randomUUID()},async()=>{started();await new Promise(r=>release=r);return {data:{public:true}};});
  const rejected=assert.rejects(fill,e=>e.status===503);
  await entered;const end=beginPublicMutation();end();release();await rejected;
  // Concurrent barriers cannot be released by another writer.
  const end1=beginPublicMutation(),end2=beginPublicMutation();end1();assert.throws(publicGeneration,e=>e.status===503);end2();publicGeneration();
  // Exercise Redis encoding/decoding with an injected store; no real Redis claim.
  const originalGet=redis.redisGet,originalSet=redis.redisSet,store=new Map();
  try {
    redis.redisGet=async key=>store.get(key)||null;
    redis.redisSet=async(key,value)=>{store.set(key,value);};
    const first=await getPublicSearchResponse({limit:'50',view:'cards',budgetMin:'2'});
    for(const entry of searchMemory.values())entry.localUntil=0;
    const count=commands;
    const second=await getPublicSearchResponse({limit:'50',view:'cards',minPrice:'02'});
    assert.equal(second.cacheHit,true);assert.equal(commands,count);assert.deepEqual(first.entry.body,second.entry.body);
    await User.updateOne({_id:owner._id},{$set:{isSuspended:true}});
    assert.equal(JSON.parse((await getPublicSearchResponse({limit:'50',view:'cards',minPrice:'2'})).entry.body).length,0);
  } finally {redis.redisGet=originalGet;redis.redisSet=originalSet;}
  const releases=[];
  const holds=Array.from({length:16},()=>admitPublicRead(()=>new Promise(r=>releases.push(r))));
  const queued=Array.from({length:32},()=>admitPublicRead(async()=>true));
  await assert.rejects(admitPublicRead(async()=>true),e=>e.status===503);
  releases.forEach(r=>r());await Promise.all([...holds,...queued]);
  assert.equal((await raw('/admin/performance','identity')).status,401);
  console.log('PASS fill/write races, concurrent barriers, Redis payload roundtrip and generation invalidation, bounded admission, protected metrics');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  redis.closeRedis();if(server){server.closeAllConnections();await app.close();}
  if(mongoose.connection.name===db){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
