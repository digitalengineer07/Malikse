// Local-only disposable database. Build server first, then node load/profile-local.cjs.
const { randomUUID } = require('crypto');
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.NODE_ENV = 'development';
process.env.REQUEST_LOGS = 'false';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { performance, monitorEventLoopDelay } = require('perf_hooks');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createApp } = require('../dist/app');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { Inquiry } = require('../dist/models/Inquiry.model');
const { SearchCache } = require('../dist/models/SearchCache.model');
const { generateTokens } = require('../dist/services/security');
const { mongoPoolOptions } = require('../dist/services/mongoPool');
const { performanceMetrics, monitorPool } = require('../dist/services/performanceMetrics');
const { closeRedis } = require('../dist/services/redis');
const { startRegionCounts, stopRegionCounts } = require('../dist/services/regionCountStore');
const dbName = 'malikse_profile_' + randomUUID().replaceAll('-', '');
const homeAutocannon = process.argv.includes('--home-autocannon') || !!process.env.PROFILE_AUTOCANNON;
const users10k = process.argv.includes('--users-10k');
const modeName = users10k ? 'users-10000-results' : homeAutocannon ? 'autocannon-home-results' : process.env.PROFILE_POOL_TEST ? 'pool-'+mongoPoolOptions().maxPoolSize : process.env.PROFILE_10K ? 'attempt-10000-rps' : process.env.PROFILE_VALIDATION ? 'steady-results' : 'local-profile';
const output = path.join(__dirname, 'runs', new Date().toISOString().replace(/[:.]/g,'-')+'-'+modeName);
const result = { environment: { date: new Date().toISOString(), node: process.version, cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, totalRAM: os.totalmem(), freeRAM: os.freemem(), database: 'local MongoDB', apiProcesses: 1, poolSize: 50, properties: 10000, users: 1000, preAllocatedVUs: Number(process.env.PREALLOCATED_VUS || 30), duration: process.env.DURATION || '20s', inquiries: 300, messagesPerInquiry: 30, note: 'API, MongoDB and k6 share this PC; development runtime, no request logs; submission worker disabled.' }, probes: [], stages: [], explains: {} };
let server, temp, stage;
Object.assign(result.environment, { poolSize: mongoPoolOptions().maxPoolSize, generator: users10k || homeAutocannon ? 'autocannon (separate process)' : 'k6 (separate process)', duration: users10k || homeAutocannon ? '5s' : (process.env.DURATION || '20s'), note: 'One API process, local MongoDB and separate generator process on this PC. Submission worker disabled.', acceptEncoding: users10k || homeAutocannon ? (process.env.LOAD_ENCODING || 'gzip') : (process.env.LOAD_ENCODING || 'generator default') });
const histogram = monitorEventLoopDelay({ resolution: 10 });
const percentile = (values, p) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1, Math.floor(values.length*p))] || 0;
function begin(name) {
  histogram.reset(); histogram.enable();
  stage = { name, commands: {}, commandMS: [], samples: [], counters: {...performanceMetrics}, start: performance.now(), cpu: process.cpuUsage(), elu: performance.eventLoopUtilization() };
}
function end() {
  histogram.disable(); const s = stage; stage = null;
  const elapsed = performance.now() - s.start, cpu = process.cpuUsage(s.cpu);
  return { name: s.name, elapsedMS: elapsed, counters: Object.fromEntries(Object.entries(performanceMetrics).map(([k,v])=>[k,v-s.counters[k]])), cpuPercentOneCore: (cpu.user+cpu.system)/elapsed/10, eventLoopUtilization: performance.eventLoopUtilization(s.elu).utilization, eventLoopP95MS: histogram.percentile(95)/1e6, eventLoopMaxMS: histogram.max/1e6, dbCommands: s.commands, dbCommandP95MS: percentile(s.commandMS,.95), peakRSS: Math.max(0,...s.samples.map(x=>x.rss)), minFreeRAM: Math.min(os.freemem(),...s.samples.map(x=>x.freeRAM)) };
}
async function main() {
  await fs.mkdir(output,{recursive:true});
  console.log('RESULTS',output);
  temp = await fs.mkdtemp(path.join(os.tmpdir(),'malikse-profile-'));
  await mongoose.connect('mongodb://127.0.0.1:27017/'+dbName,{autoIndex:false,...mongoPoolOptions(),monitorCommands:true});
  monitorPool(mongoose.connection.getClient());
  mongoose.connection.getClient().on('commandSucceeded', e => { if(stage) { stage.commands[e.commandName]=(stage.commands[e.commandName]||0)+1; stage.commandMS.push(e.duration); } });
  const timer = setInterval(()=> { if(stage) stage.samples.push({rss:process.memoryUsage().rss,freeRAM:os.freemem()}); },250); timer.unref();
  const hash = await bcrypt.hash('Local-profile-password',10);
  const users = await User.insertMany(Array.from({length:1000},(_,i)=>({name:`Local user ${i}`,mobile:String(9200000000+i),role:'user',passwordHash:hash,demoKycComplete:true})));
  const admin = await User.create({name:'Local admin',mobile:'9200009999',role:'admin',passwordHash:hash});
  const ids=[];
  for(let batch=0;batch<20;batch++) {
    const docs = await Property.insertMany(Array.from({length:500},(_,j)=> { const i=batch*500+j; return {ownerId:users[i%200]._id,title:`Local property ${i}`,description:'Representative property description. '.repeat(8),type:['land','flat','house','shop','office'][i%5],location:{state:'Bihar',district:'Patna',pincode:'800001',block:'Kankarbagh',lat:25.6,lng:85.1},price:100000+i*100,totalArea:1000,sellableArea:900,status:'verified',badges:{fullyVerified:true},advisorReview:{decision:'approve'},verifierReview:{decision:'approve'}}; }));
    if(!batch) ids.push(...docs.slice(0,200).map(d=>String(d._id)));
  }
  await Inquiry.insertMany(Array.from({length:300},(_,i)=>({propertyId:ids[0],buyerId:users[1]._id,sellerId:users[0]._id,message:`Inquiry ${i}`,messages:Array.from({length:30},()=>({senderId:users[1]._id,text:'Message content. '.repeat(10),createdAt:new Date()}))})));
  await Promise.all([User.createIndexes(),Property.createIndexes(),Inquiry.createIndexes(),SearchCache.createIndexes()]);
  await startRegionCounts();
  const fixture={tokens:users.slice(0,200).map(u=>generateTokens(u).accessToken),adminToken:generateTokens(admin).accessToken,propertyIds:ids,propertyCount:10000};
  const fixturePath=path.join(temp,'fixture.json'); await fs.writeFile(fixturePath,JSON.stringify(fixture));
  if(process.env.PROFILE_PM2==='1') {
    if(global.gc)global.gc();
    await require('./pm2-profile.cjs')({dbName,output});
    clearInterval(timer);return;
  }
  server=createApp().listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function probe(name,route,token,options={}) {
    begin(name); const t=performance.now();
    const response=await fetch(base+route,{...options,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});
    const body=await response.text();
    result.probes.push({...end(),status:response.status,bytes:Buffer.byteLength(body),latencyMS:performance.now()-t});
    console.log('PROBE',name,response.status,Buffer.byteLength(body));
  }
  for(const [name,route,token] of [
    ['health','/health'],['search-cold','/properties/search?limit=50'],['search-warm','/properties/search?limit=50'],
    ['search-deep','/properties/search?limit=100&page=100'],['search-text','/properties/search?location=Patna&limit=50'],
    ['search-address-cold','/properties/search?limit=50&view=cards&address=Kankarbagh'],
    ['regions-state-cold','/properties/regions'],['regions-district-cold','/properties/regions?state=Bihar'],
    ['regions-pincode-cold','/properties/regions?state=Bihar&district=Patna'],
    ['suggest-state-cold','/properties/regions/suggest?q=Biha'],['suggest-district-cold','/properties/regions/suggest?q=Pat'],
    ['suggest-pincode-cold','/properties/regions/suggest?q=8000'],['suggest-address-cold','/properties/regions/suggest?q=Kankar'],
    ['profile','/users/profile',fixture.tokens[0]],['mine','/properties/mine',fixture.tokens[0]],
    ['summary','/admin/dashboard/summary',fixture.adminToken],['admin-properties','/admin/properties',fixture.adminToken],
    ['admin-users','/admin/users',fixture.adminToken],['inbox','/inquiries/received',fixture.tokens[0]],
  ]) await probe(name,route,token);
  for(const [name,query,sort,skip,limit] of [
    ['newest',{status:'verified','badges.fullyVerified':true,'advisorReview.decision':'approve','verifierReview.decision':'approve'},{createdAt:-1,_id:-1},0,50],
    ['deep-page',{status:'verified'},{createdAt:-1,_id:-1},9900,100],
    ['text-search',{$text:{$search:'Patna'},status:'verified'},{createdAt:-1,_id:-1},0,50],
  ]) result.explains[name]=await Property.find(query).sort(sort).skip(skip).limit(limit).explain('executionStats');
  result.explains.dashboard=await Property.aggregate([{$group:{_id:'$status',count:{$sum:1}}}]).explain('executionStats');
  if(users10k) {
    const route='/properties/search?limit=50&view=cards';
    const check=await fetch(base+route);
    if(check.status!==200 || !(await check.json()).length) throw Error('Home search did not return populated data');
    console.log('AUTOCANNON 10000 users x 1 request/s, 5 seconds, 1000 generator connections');
    begin('users-10000-home');
    const summaryFile=path.join(output,'autocannon.json');
    const code=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(__dirname,'users-10000-autocannon.cjs')],{stdio:'inherit',env:{...process.env,BASE_URL:base,SUMMARY_FILE:summaryFile}});
      child.on('error',reject);child.on('exit',resolve);
    });
    result.stages.push({...end(),route,requestedUsers:10000,requestsPerUserPerSecond:1,offeredRPS:10000,generatorConnections:1000,durationSeconds:5,generatorExitCode:code,summaryFile:'autocannon.json'});
    if(code!==0) result.resourceStop='Autocannon exited with an error';
    else {
      const raw=JSON.parse(await fs.readFile(summaryFile,'utf8'));
      result.targetMet=raw.result.requests.total>=raw.targetRequests && raw.result.non2xx===0 && raw.result.errors===0 && raw.result.timeouts===0;
      if(!result.targetMet) process.exitCode=1;
    }
  } else if(homeAutocannon) {
    const first = await fetch(base+'/properties/search?limit=50&view=cards');
    const cursor = first.headers.get('x-next-cursor');
    if(first.status!==200 || !cursor || !(await first.json()).length) throw Error('Home first page did not return populated data and a next cursor');
    const cases = [
      ['home-default','/properties/search?limit=50&view=cards'],
      ['home-type','/properties/search?limit=50&type=land&view=cards'],
      ['home-location','/properties/search?limit=50&location=Patna&view=cards'],
      ['home-price','/properties/search?limit=50&budgetMin=100000&budgetMax=500000&view=cards'],
      ['home-next-page','/properties/search?limit=50&view=cards&cursor='+encodeURIComponent(cursor)],
      ['home-detail','/properties/'+ids[0]],
      ['home-state','/properties/search?limit=50&view=cards&state=Bihar'],
      ['home-district','/properties/search?limit=50&view=cards&state=Bihar&district=Patna'],
      ['home-pincode','/properties/search?limit=50&view=cards&state=Bihar&district=Patna&pincode=800001'],
      ['home-address','/properties/search?limit=50&view=cards&address=Kankarbagh'],
      ['regions-state','/properties/regions'],
      ['regions-district','/properties/regions?state=Bihar'],
      ['regions-pincode','/properties/regions?state=Bihar&district=Patna'],
      ['suggest-state','/properties/regions/suggest?q=Biha'],
      ['suggest-district','/properties/regions/suggest?q=Pat'],
      ['suggest-pincode','/properties/regions/suggest?q=8000'],
      ['suggest-address','/properties/regions/suggest?q=Kankar'],
    ];
    for(const [name,route] of cases) {
      const check = await fetch(base+route);
      const data = await check.json();
      const populated = Array.isArray(data) ? data.length > 0 : name.startsWith('regions-') ? data.groups?.length > 0 : name.startsWith('suggest-') ? data.data?.length > 0 : !!data._id;
      if(check.status!==200 || !populated) throw Error(`${name} failed preflight: HTTP ${check.status}`);
      console.log('AUTOCANNON',name,route);
      begin(name);
      const summaryFile=path.join(output,name+'.json');
      const code=await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[path.join(__dirname,'autocannon-request.cjs')],{stdio:'inherit',env:{...process.env,BASE_URL:base,LOAD_PATH:route,SUMMARY_FILE:summaryFile}});
        child.on('error',reject);child.on('exit',resolve);
      });
      if(code!==0) throw Error('Autocannon failed: '+name);
      const raw=JSON.parse(await fs.readFile(summaryFile,'utf8'));
      result.stages.push({...end(),route,connections:20,durationSeconds:5,requests:raw.requests,latency:raw.latency,throughput:raw.throughput,errors:raw.errors,timeouts:raw.timeouts,non2xx:raw.non2xx,resets:raw.resets});
      await fs.writeFile(path.join(output,'profile.json'),JSON.stringify(result,null,2));
      if(os.freemem()<250*1024*1024) { result.resourceStop='Free RAM below 250 MiB';break; }
    }
  } else {
  const stages = process.env.PROFILE_HOME_STEADY ? [['home',2000]] : process.env.PROFILE_POOL_TEST ? [['mixed',400],['cold',100]] : process.env.PROFILE_10K ? [['mixed',10000]] : process.env.PROFILE_VALIDATION ? [['mixed',400],['cold',250]] : process.env.PROFILE_RELEASE ? [['mixed',250],['mixed',400],['mixed',500],['cold',250],['admin',2],['inbox',10]] : process.env.PROFILE_TUNED ? [['mixed',250],['mixed',400],['mixed',500],['cold',250],['admin',2],['inbox',10]] : process.env.PROFILE_FINAL ? [['mixed',250],['mixed',400],['mixed',500],['cold',250],['admin',2],['inbox',10]] : process.env.PROFILE_FOLLOWUP ? [['mixed',100],['mixed',150]] : [['mixed',50],['mixed',250],['mixed',500],['mixed',1000],['cold',250],['admin',2],['inbox',10]];
  for(const [mode,rate] of stages) {
    const name=`${mode}-${rate}`; console.log('STAGE',name); begin(name);
    const file=path.join(output,name+'.json');
    const code=await new Promise((resolve,reject)=> { const child=spawn('k6.exe',['run','--quiet','--summary-export',file,path.join(__dirname,'local-profile.js')],{stdio:'inherit',env:{...process.env,BASE_URL:base,FIXTURE_PATH:fixturePath,RPS:String(rate),MODE:mode}});child.on('error',reject);child.on('exit',resolve); });
    result.stages.push({...end(),exitCode:code,summaryFile:name+'.json'});
    if((process.env.PROFILE_POOL_TEST || process.env.PROFILE_HOME_STEADY) && code!==0) process.exitCode=1;
    await fs.writeFile(path.join(output,'profile.json'),JSON.stringify(result,null,2));
    if(os.freemem()<250*1024*1024) { result.resourceStop='Free RAM below 250 MiB';break; }
  }
  }
  // Only ten logins: retain the real 20/minute limiter and isolate hashing cost.
  begin('login-concurrency-10');
  const loginStart=performance.now();
  const logins=await Promise.all(Array.from({length:10},async(_,i)=> {const t=performance.now();const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mobile:String(9200000000+i),password:'Local-profile-password'})});await r.text();return {status:r.status,latencyMS:performance.now()-t};}));
  result.login={...end(),wallMS:performance.now()-loginStart,responses:logins};
  if(process.env.PROFILE_FOLLOWUP) {
    result.hydrationComparison=[];
    for(let repeat=0;repeat<3;repeat++) for(const lean of [false,true]) {
      const start=performance.now(); const query=Property.find({}).sort({createdAt:-1});
      const docs=await (lean?query.lean():query); const readMS=performance.now()-start;
      const serializeStart=performance.now(); const bytes=Buffer.byteLength(JSON.stringify(docs));
      result.hydrationComparison.push({repeat,lean,readMS,serializeMS:performance.now()-serializeStart,bytes});
    }
    const json = body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    await probe('create-inquiry','/inquiries',fixture.tokens[1],json({propertyId:ids[0],message:'Local test inquiry',offerAmount:100000}));
    await probe('create-offer',`/deals/${ids[0]}/offer`,fixture.tokens[1],json({amount:100000}));
    await probe('wishlist-toggle',`/users/wishlist/${ids[0]}`,fixture.tokens[1],json({}));
    await probe('wishlist-read','/users/wishlist',fixture.tokens[1]);
    await probe('update-profile','/users/profile',fixture.tokens[1],{...json({name:'Updated local user'}),method:'PUT'});
  }
  await fs.writeFile(path.join(output,'profile.json'),JSON.stringify(result,null,2));
  clearInterval(timer);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await stopRegionCounts();
  closeRedis();
  if(server) await new Promise(r=>server.close(r));
  if(mongoose.connection.readyState===1) {if(mongoose.connection.name!==dbName || !dbName.startsWith('malikse_profile_')) throw Error('Cleanup guard failed');await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable database removed');}
  if(temp) {await fs.unlink(path.join(temp,'fixture.json')).catch(()=>{});await fs.rmdir(temp);}
  // PM2's Windows client may retain IPC handles after its isolated daemon exits.
  if(process.env.PROFILE_PM2==='1') process.exit(process.exitCode || 0);
});
