const assert=require('assert/strict');
const {randomUUID}=require('crypto');
process.env.NODE_ENV='development';process.env.REQUEST_LOGS='false';
process.env.JWT_ACCESS_SECRET=randomUUID();process.env.JWT_REFRESH_SECRET=randomUUID();
process.env.REDIS_URL='';process.env.PUBLIC_RESPONSE_CACHE_ENABLED='true';
const mongoose=require('mongoose');
const {createApp}=require('../dist/app');
const {User}=require('../dist/models/User.model');
const {Property}=require('../dist/models/Property.model');
const {startRegionCounts,refreshRegionCounts,stopRegionCounts,markRegionCountsDirty}=require('../dist/services/regionCountStore');
const {RegionCountState,RegionCount}=require('../dist/models/RegionCount.model');
async function syncCounts(){for(let i=0;i<20;i++){await refreshRegionCounts();const s=await RegionCountState.findById('public-regions-v1').lean();if(s&&s.revision===s.builtRevision)return;await new Promise(r=>setTimeout(r,50));}throw Error('Counts did not settle');}
const db='malikse_regions_test_'+randomUUID().replaceAll('-','');
let server,base,reads=0,sourceReads=0;
async function get(path,status=200){const r=await fetch(base+path);assert.equal(r.status,status);return {data:await r.json(),cursor:r.headers.get('x-next-cursor')};}
async function main(){
  await mongoose.connect('mongodb://127.0.0.1:27017/'+db,{monitorCommands:true});
  mongoose.connection.getClient().on('commandStarted',e=>{if(['find','aggregate'].includes(e.commandName)){reads++;if(['properties','users'].includes(e.command[e.commandName]))sourceReads++;}});
  const [owner,hidden]=await User.create([{name:'Owner',mobile:'9200010001',role:'user'},{name:'Hidden',mobile:'9200010002',role:'user',isSuspended:true}]);
  const fixture={ownerId:owner._id,type:'land',price:100000,totalArea:1000,sellableArea:900,title:'Must not appear in count payload',status:'verified',badges:{fullyVerified:true},advisorReview:{decision:'approve'},verifierReview:{decision:'approve'}};
  const location=(state,district,pincode)=>({state,district,pincode,block:district==='Patna'?'Kankarbagh':'Tower Chowk',mauza:'Central Ward',policeStation:'City Police',lat:25.6,lng:85.1});
  await Property.insertMany([
    ...Array.from({length:51},()=>({...fixture,location:location('Bihar','Patna','800001')})),
    ...Array.from({length:3},()=>({...fixture,location:location('Bihar','Patna','800002'),type:'house'})),
    ...Array.from({length:2},()=>({...fixture,location:location('Bihar','Patna','')})),
    ...Array.from({length:4},()=>({...fixture,location:location('Bihar','Gaya','823001')})),
    {...fixture,location:location('Uttar Pradesh','Patna','800001')},
    {...fixture,ownerId:hidden._id,location:location('Bihar','Patna','800001')},
    {...fixture,status:'draft',location:location('Bihar','Patna','800001')},
  ]);
  await Property.createIndexes();
  await startRegionCounts();await syncCounts();
  server=createApp().listen(Number(process.env.REGION_UI_PORT||0),'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
  const countSourceReads=sourceReads;
  const states=(await get('/properties/regions')).data;
  assert.equal(states.level,'state');assert.deepEqual(states.groups.map(g=>[g.name,g.count]),[['Bihar',60],['Uttar Pradesh',1]]);
  const before=reads;await get('/properties/regions');assert.equal(reads,before,'warm counts must use no Mongo reads');
  states.groups.forEach(g=>assert.deepEqual(Object.keys(g).sort(),['count','key','lat','lng','name']));
  const districts=(await get('/properties/regions?state=Bihar')).data;
  assert.equal(districts.level,'district');assert.deepEqual(districts.groups.map(g=>[g.name,g.count]),[['Gaya',4],['Patna',56]]);
  const pins=(await get('/properties/regions?state=Bihar&district=Patna')).data;
  assert.equal(pins.level,'pincode');assert.deepEqual(pins.groups.map(g=>[g.key,g.count]),[['__missing__',2],['800001',51],['800002',3]]);
  const houses=(await get('/properties/regions?state=Bihar&district=Patna&type=house')).data;
  assert.deepEqual(houses.groups.map(g=>[g.key,g.count]),[['800002',3]]);
  assert.equal(sourceReads,countSourceReads,'state, district, pincode and type count requests must never query Property or User');
  const explain=await RegionCount.find({generation:(await RegionCountState.findById('public-regions-v1')).generation,level:'pincode',state:'Bihar',district:'Patna',propertyType:'all'}).explain('executionStats');
  assert.ok(explain.executionStats.totalDocsExamined<=3,'area count lookup must use its compound index');
  const suggest=async q=>(await get('/properties/regions/suggest?q='+encodeURIComponent(q))).data;
  assert.ok((await suggest('Biha')).some(item=>item.kind==='state'&&item.state==='Bihar'));
  assert.ok((await suggest('Pat')).some(item=>item.kind==='district'&&item.district==='Patna'));
  assert.equal((await suggest('Pat')).filter(item=>item.kind==='district'&&item.state==='Bihar'&&item.district==='Patna').length,1);
  assert.ok((await suggest('8000')).some(item=>item.kind==='pincode'&&item.pincode==='800001'));
  assert.ok((await suggest('Kankar')).some(item=>item.kind==='address'&&item.label.includes('Kankarbagh')));
  assert.ok((await suggest('City Police')).some(item=>item.kind==='address'));
  assert.ok((await get('/properties/regions/suggest?q=Pat&type=house')).data.some(item=>item.kind==='district'));
  const beforeSuggest=reads;await suggest('Kankar');assert.equal(reads,beforeSuggest,'warm suggestions must use no Mongo reads');
  assert.equal((await get('/properties/search?view=cards&address=Kankar')).data.length,57);
  assert.equal((await get('/properties/search?view=cards&address=Tower')).data.length,4);
  assert.equal((await get('/properties/search?view=cards&address=City%20Police')).data.length,61);
  assert.equal((await get('/properties/search?view=cards&address=.*')).data.length,0,'regex input must be treated literally');
  let cursor,ids=[];
  do {const page=await get('/properties/search?view=cards&limit=20&state=Bihar&district=Patna&pincode=800001'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.ok(page.data.length<=20);page.data.forEach(p=>assert.equal(p.location.pincode,'800001'));ids.push(...page.data.map(p=>p._id));cursor=page.cursor;}while(cursor);
  assert.equal(ids.length,51);assert.equal(new Set(ids).size,51);
  assert.equal((await get('/properties/search?state=Bihar&district=Patna&pincode=__missing__')).data.length,2);
  assert.equal((await get('/properties/regions?state=Bihar&district=Absent')).data.groups.length,0);
  await get('/properties/regions?district=Patna',400);await get('/properties/regions?state[x]=Bihar',400);await get('/properties/regions?type=invalid',400);await get('/properties/search?pincode=bad',400);
  await get('/properties/regions/suggest?q=a',400);await get('/properties/regions/suggest?q[x]=Patna',400);
  await assert.rejects(Property.create({...fixture,location:location('Bihar','Patna','123')}));
  await User.updateOne({_id:owner._id},{$set:{isSuspended:true}});
  await syncCounts();
  assert.equal((await get('/properties/regions')).data.groups.length,0);
  assert.equal((await suggest('Patna')).length,0);
  await User.updateOne({_id:owner._id},{$set:{isSuspended:false}});
  await Property.updateOne({_id:ids[0]},{$set:{'location.pincode':'800002'}});
  await syncCounts();
  const updated=(await get('/properties/regions?state=Bihar&district=Patna')).data;
  assert.equal(updated.groups.find(g=>g.key==='800001').count,50);assert.equal(updated.groups.find(g=>g.key==='800002').count,4);
  // Publication must be atomic even if a mutation arrives during refresh.
  const previousGeneration=(await RegionCountState.findById('public-regions-v1')).generation;
  const insert=RegionCount.insertMany;
  let injected=false;
  RegionCount.insertMany=async function(...args){const result=await insert.apply(this,args);if(!injected){injected=true;await markRegionCountsDirty();}return result;};
  try {await markRegionCountsDirty();await refreshRegionCounts();assert.equal((await RegionCountState.findById('public-regions-v1')).generation,previousGeneration,'a raced rebuild must not replace the complete snapshot');}
  finally {RegionCount.insertMany=insert;}
  await syncCounts();
  const temporary=await Property.create({...fixture,type:'house',location:location('Bihar','Patna','800099')});
  await syncCounts();
  const countAt=async()=>((await get('/properties/regions?state=Bihar&district=Patna')).data.groups.find(g=>g.key==='800099')?.count||0);
  assert.equal(await countAt(),1,'new published listing');
  temporary.status='sold';await temporary.save();await syncCounts();assert.equal(await countAt(),0,'sold listing removed');
  temporary.status='verified';await temporary.save();await syncCounts();assert.equal(await countAt(),1,'save restores published count');
  await Property.updateOne({_id:temporary._id},{$set:{'verifierReview.decision':'reject'}});await syncCounts();assert.equal(await countAt(),0,'approval removed');
  await Property.updateOne({_id:temporary._id},{$set:{'verifierReview.decision':'approve'}});await syncCounts();assert.equal(await countAt(),1);
  await User.updateOne({_id:owner._id},{$set:{isActive:false}});await syncCounts();assert.equal((await get('/properties/regions')).data.groups.length,0);
  await User.updateOne({_id:owner._id},{$set:{isActive:true}});await syncCounts();assert.equal(await countAt(),1);
  await Property.deleteOne({_id:temporary._id});await syncCounts();assert.equal(await countAt(),0,'deleted listing removed');
  console.log('PASS materialized counts: zero source reads on count requests, indexed lookup, atomic snapshot swap, publication changes, sold/deleted listings, owner activity');
  console.log('PASS state/district/pincode counts, global location suggestions, direct address search, regex safety, warm cache, visibility, parent/type filters, missing pincodes, 3-page traversal, validation and invalidation');
  console.log('State count payload bytes:',Buffer.byteLength(JSON.stringify(states)));
  if(process.env.REGION_UI_PORT){
    await Property.updateOne({_id:ids[0]},{$set:{'location.pincode':'800001'}});
    console.log('Disposable UI fixture ready at',base,'for 5 minutes');
    await new Promise(resolve=>setTimeout(resolve,300000));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await stopRegionCounts();if(mongoose.connection.name===db){await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
