// Benchmark only: disposable loopback DB and read-only HTTP surface.
const fs=require('fs');
const path=require('path');
const express=require('express');
const mongoose=require('mongoose');
const {performance,monitorEventLoopDelay}=require('perf_hooks');
const {createApp}=require('../dist/app');
const {performanceMetrics,monitorPool}=require('../dist/services/performanceMetrics');
const {mongoPoolOptions}=require('../dist/services/mongoPool');
const uri=process.env.MONGO_URI;
if(!/^mongodb:\/\/127\.0\.0\.1:27017\/malikse_profile_[a-f0-9]+$/.test(uri||'')) throw Error('Disposable local DB required');
const metricsFile=path.join(process.env.BENCH_OUTPUT,`worker-${process.env.NODE_APP_INSTANCE}.json`);
let commands=0, started=performance.now(), cpu=process.cpuUsage(), peakRSS=0;
const loop=monitorEventLoopDelay({resolution:10});loop.enable();
function save(){
  peakRSS=Math.max(peakRSS,process.memoryUsage().rss);
  fs.writeFileSync(metricsFile,JSON.stringify({pid:process.pid,instance:process.env.NODE_APP_INSTANCE,elapsedMS:performance.now()-started,cpu:process.cpuUsage(cpu),peakRSS,commands,counters:{...performanceMetrics},eventLoopP95MS:loop.percentile(95)/1e6}));
}
async function main(){
  await mongoose.connect(uri,{autoIndex:false,monitorCommands:true,...mongoPoolOptions()});
  monitorPool(mongoose.connection.getClient());
  mongoose.connection.getClient().on('commandStarted',e=>{if(['find','aggregate','count'].includes(e.commandName))commands++;});
  const app=express();
  app.use((req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
    res.setHeader('X-Benchmark-Worker',String(process.pid));next();
  });
  app.use(createApp());
  const server=app.listen(Number(process.env.PORT),'127.0.0.1',()=>{save();if(process.send)process.send('ready');});
  const timer=setInterval(save,250);
  process.on('message',message=>{
    if(message?.data?.action==='reset'){
      for(const key of Object.keys(performanceMetrics))performanceMetrics[key]=0;
      commands=0;started=performance.now();cpu=process.cpuUsage();peakRSS=0;loop.reset();save();
    }
  });
  async function stop(){clearInterval(timer);server.closeAllConnections();server.close();save();await mongoose.disconnect();process.exit(0);}
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
