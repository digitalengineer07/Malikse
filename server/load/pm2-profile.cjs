const fs=require('fs/promises');
const path=require('path');
const net=require('net');
const os=require('os');
const {spawn}=require('child_process');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function run({dbName,output}){
  // Dedicated PM2 home: never stop or change the user's existing PM2 apps.
  process.env.PM2_HOME=path.join(output,'pm2-home');
  // Windows defaults to OS scheduling; use Node round-robin for this comparison.
  process.env.NODE_CLUSTER_SCHED_POLICY='rr';
  const pm2=require('pm2');
  const call=(method,...args)=>new Promise((resolve,reject)=>pm2[method](...args,(error,value)=>error?reject(error):resolve(value)));
  const sweep=process.env.PM2_SWEEP==='1';
  const counts=sweep?[2,3,4,6,8,10,12].filter(n=>n<=os.cpus().length):[2];
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port;await new Promise(r=>socket.close(r));
  const base=`http://127.0.0.1:${port}`;
  const report={date:new Date().toISOString(),counts,logicalCPUs:os.cpus().length,totalRAM:os.totalmem(),startingFreeRAM:os.freemem(),poolPerWorker:10,cpu:os.cpus()[0].model,pm2Version:require('pm2/package.json').version,stages:[],note:'Read-only disposable local snapshot. API, Mongo, PM2 and generator share this PC. No Redis; separate generator. Sweep stops on memory pressure or two consecutive gains below 5%.'};
  const configs=counts.flatMap(instances=>(sweep?[true]:[true,false]).map(cached=>({instances,cached})));
  let smallGains=0;
  await call('connect');
  try{
    for(const {instances,cached} of configs){
      if(sweep && os.freemem()<(320+instances*60)*1024*1024){report.stopReason=`Insufficient free RAM to start ${instances} workers with generator headroom`;break;}
      const name=(sweep?instances+'-workers-':'')+(cached?'snapshot-cached':'cache-disabled');
      const folder=path.join(output,name);await fs.mkdir(folder,{recursive:true});
      await call('start',{name:'malikse-local-benchmark',script:path.join(__dirname,'pm2-worker.cjs'),cwd:path.join(__dirname,'..'),exec_mode:'cluster',instances,wait_ready:true,listen_timeout:20000,autorestart:false,kill_timeout:3000,
        env:{NODE_ENV:'development',MONGO_URI:`mongodb://127.0.0.1:27017/${dbName}`,PORT:String(port),BENCH_OUTPUT:folder,PUBLIC_RESPONSE_CACHE_ENABLED:String(cached),REDIS_URL:'',MONGO_MAX_POOL_SIZE:'10',SUBMISSION_WORKER_ENABLED:'false',REQUEST_LOGS:'false',JWT_ACCESS_SECRET:process.env.JWT_ACCESS_SECRET,JWT_REFRESH_SECRET:process.env.JWT_REFRESH_SECRET},
        out_file:path.join(folder,'stdout.log'),error_file:path.join(folder,'stderr.log')});
      const workers=(await call('list')).filter(p=>p.name==='malikse-local-benchmark');
      if(workers.length!==instances||workers.some(p=>p.pm2_env.status!=='online'))throw Error('PM2 workers failed startup');
      const seen=new Set();
      await Promise.all(Array.from({length:Math.max(40,instances*12)},async()=>{
        const r=await fetch(base+'/properties/search?limit=50&view=cards',{headers:{Connection:'close'}});
        if(r.status!==200||(await r.json()).length!==50)throw Error('Unpopulated home response');
        seen.add(Number(r.headers.get('x-benchmark-worker')));
      }));
      if(seen.size!==instances)throw Error('Not all workers warmed');
      for(const worker of workers)await call('sendDataToProcessId',{id:worker.pm_id,type:'process:msg',topic:'benchmark',data:{action:'reset'}});
      await pause(300);
      console.log('PM2 TEST',name,'workers',workers.map(p=>p.pid));
      const summaryFile=path.join(folder,'autocannon.json');
      let minFreeRAM=os.freemem();
      const memorySampler=setInterval(()=>{minFreeRAM=Math.min(minFreeRAM,os.freemem());},100);
      let code;
      try {code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'users-10000-autocannon.cjs')],{stdio:'inherit',env:{...process.env,BASE_URL:base,SUMMARY_FILE:summaryFile,LOAD_ENCODING:'gzip',LOAD_MEMORY_FLOOR_MIB:sweep?'256':'150'}});child.on('error',reject);child.on('exit',resolve);});}
      finally {clearInterval(memorySampler);}
      await pause(500);
      const metrics=await Promise.all(workers.map(async w=>JSON.parse(await fs.readFile(path.join(folder,`worker-${w.pm2_env.NODE_APP_INSTANCE}.json`),'utf8'))));
      const raw=JSON.parse(await fs.readFile(summaryFile,'utf8'));
      const stage={name,instances,minFreeRAM,resourceStop:raw.resourceStop,exitCode:code,prepared:raw.preparedRequests,completed:raw.result.requests.total,rps:raw.result.requests.average,non2xx:raw.result.non2xx,errors:raw.result.errors,timeouts:raw.result.timeouts,latency:raw.result.latency,workers:metrics,targetMet:raw.result.requests.total>=50000&&raw.result.non2xx===0&&raw.result.errors===0&&!raw.resourceStop};
      report.stages.push(stage);console.log('PM2 RESULT',JSON.stringify({name,rps:stage.rps,completed:stage.completed,non2xx:stage.non2xx,targetMet:stage.targetMet}));
      if(!stage.targetMet)process.exitCode=1;
      await fs.writeFile(path.join(output,'pm2-report.json'),JSON.stringify(report,null,2));
      await call('delete','malikse-local-benchmark');
      if(raw.resourceStop){report.stopReason=raw.resourceStop;break;}
      if(sweep){
        const previous=report.stages.at(-2);
        if(previous)smallGains=stage.rps<previous.rps*1.05?smallGains+1:0;
        if(minFreeRAM<384*1024*1024){report.stopReason='Free RAM below 384 MiB during load; no additional workers';break;}
        if(smallGains>=2){report.stopReason='Two consecutive worker increases improved throughput by less than 5%';break;}
        await pause(1000);
      }
    }
    report.bestCompletedStage=report.stages.filter(s=>!s.resourceStop).sort((a,b)=>b.rps-a.rps)[0]?.name;
    if(!report.stages.length)process.exitCode=1;
    await fs.writeFile(path.join(output,'pm2-report.json'),JSON.stringify(report,null,2));
    console.log('PM2 SWEEP SUMMARY',JSON.stringify({best:report.bestCompletedStage,stopReason:report.stopReason}));
  }finally{await call('killDaemon');pm2.disconnect();}
};
