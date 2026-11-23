// Run against an isolated local replica set. Each run owns a fresh database.
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setTimeout: sleep } = require("node:timers/promises");
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.NODE_ENV = "test";
const { createFastifyApp } = require("../dist/fastifyApp");
const { generateTokens } = require("../dist/services/security");
const { mongoPoolOptions } = require("../dist/services/mongoPool");
const { performanceMetrics, monitorPool } = require("../dist/services/performanceMetrics");
const { deliverNotifications } = require("../dist/services/notificationQueue");
const { User } = require("../dist/models/User.model");
const { Inquiry } = require("../dist/models/Inquiry.model");
const { Property } = require("../dist/models/Property.model");
const { Notification } = require("../dist/models/Notification.model");
async function main() {
  const size = Number(process.argv[2]), seconds = Number(process.argv[3] ?? 65);
  assert(size >= 2 && size <= 500 && size % 2 === 0 && (seconds >= 60 || (seconds===0 && process.argv.includes("--autocannon"))));
  await mongoose.connect("mongodb://127.0.0.1:27183/?replicaSet=chatbench", {
    dbName: "chatbench_" + randomUUID().replaceAll("-", ""), ...mongoPoolOptions(),
  });
  monitorPool(mongoose.connection.getClient());
  const app = createFastifyApp();
  const stats = {}, codes = {}, sent = new Set(), acknowledged = new Map(), samples = [];
  const improved = process.argv.includes("--updated");
  const cached = new Map();
  let worker, draining = false;
  try {
    await Promise.all([User, Property, Inquiry, Notification].map(model => model.init()));
    const users = await User.insertMany(Array.from({length:size}, (_,i) => ({
      role: i%2 ? "advisor" : "user", name: "Fixture "+i, mobile:String(9110000000+i),
      isVerifiedIdentity:true, passwordHash:"fixture",
    })));
    const pairs = users.filter((_,i)=>i%2===0);
    const properties = await Property.insertMany(pairs.map((u,i)=>({ ownerId:users[1]._id,
      assignedAdvisorId:users[2*i+1]._id, title:"Test", type:"land", location:{state:"Bihar",district:"Patna",lat:25,lng:85},
      price:100,totalArea:10,sellableArea:10,status:"verified" })));
    const threads = await Inquiry.insertMany(pairs.map((u,i)=>({ buyerId:u._id,staffId:users[2*i+1]._id,propertyId:properties[i]._id,message:"Hello" })));
    const plan = await Inquiry.find({buyerId:users[0]._id}).sort({updatedAt:-1,_id:-1}).explain("executionStats");
    const planText = JSON.stringify(plan.queryPlanner.winningPlan);
    const base = await app.listen({port:0,host:"127.0.0.1"});
    const tokens = users.map(u=>generateTokens(u).accessToken);
    async function call(i,kind,path,body) {
      const start = performance.now();
      const cacheKey=i+" "+path;
      const snapshot=improved && kind==="poll" && cached.get(cacheKey);
      const r = await fetch(base+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+tokens[i],"Content-Type":"application/json",...(snapshot?{"If-None-Match":snapshot.etag}:{})},body:body&&JSON.stringify(body)});
      const value = r.status===304 ? snapshot.value : await r.json();
      if(improved && kind==="poll" && r.status===200)cached.set(cacheKey,{value,etag:r.headers.get("etag")});
      (stats[kind]??=[]).push(performance.now()-start);
      codes[r.status]=(codes[r.status]||0)+1;
      return r.ok || r.status===304 ? value : null;
    }
    worker = setInterval(async()=>{
      if(draining)return;
      draining=true;
      try{await deliverNotifications();samples.push([Date.now(),Math.round(process.memoryUsage().heapUsed/1048576),performanceMetrics.poolCheckedOut,await Notification.countDocuments({deliveredAt:null,failedAt:null})]);}
      finally{draining=false;}
    },10000);
    const end=Date.now()+seconds*1000;
    const pushes=Array(size).fill(0);
    await Promise.all(users.map(async(u,i)=>{
      await sleep(Math.random()*1500);
      const path="/inquiries/"+threads[Math.floor(i/2)]._id;
      await call(i,"inbox","/inquiries?sort=activity");
      await call(i,"detail",path);
      let nextSend=Date.now()+Math.random()*55000, nextPoll=Date.now(), lastPush=0;
      while(Date.now()<end){
        if(Date.now()>=nextSend){
          const text=randomUUID();
          const saved=await call(i,"send",path+"/message",{text,clientMessageId:text});
          if(saved){sent.add(text);pushes[i^1]=Date.now()+350;}
          nextSend+=60000;
        }
        const push=pushes[i] && Date.now()>=pushes[i];
        if(push||Date.now()>=nextPoll){
          if(push){pushes[i]=0;lastPush=Date.now();await call(i,"bell","/push/notifications/unread");}
          if(!push && improved && Date.now()-lastPush<15000){nextPoll=Date.now()+15000+Math.random()*4000;continue;}
          const page=await call(i,"poll",path+"/messages");
          const latest=page?.messages.slice().reverse().find(row=>String(row.senderId)!==String(u._id));
          if(latest && (!page.ownReadAt||latest.createdAt>page.ownReadAt)){
            await sleep(800);
            if(await call(i,"ack",path+"/read",{through:latest.createdAt}))acknowledged.set(i,latest.createdAt);
          }
          if(!push)nextPoll=Date.now()+15000+Math.random()*4000;
        }
        await sleep(150);
      }
    }));
    const rows=await Inquiry.find().lean();
    const texts=rows.flatMap(r=>r.messages.map(m=>m.text));
    assert.equal(texts.length,sent.size);assert.deepEqual(new Set(texts),sent);
    for(const [i,time] of acknowledged){const row=rows.find(r=>String(r._id)===String(threads[Math.floor(i/2)]._id));assert.equal(row[i%2?"staffReadAt":"buyerReadAt"].toISOString(),time);}
    const summary={};
    for(const [kind,values] of Object.entries(stats)){values.sort((a,b)=>a-b);summary[kind]={count:values.length,ms:[.5,.95,.99].map(q=>Math.round(values[Math.ceil(values.length*q)-1]))};}
    console.log(JSON.stringify({size,seconds,codes,stats:summary,poolFailures:performanceMetrics.poolFailures,samples,activitySort:planText.includes('"SORT"'),messages:texts.length}));
    if (process.argv.includes("--autocannon")) {
      const autocannon = require("autocannon");
      let actor = 0;
      const result = await autocannon({
        url:base, connections:Math.min(size,32), amount:size*4, pipelining:1,
        overallRate:Math.max(2,Math.ceil(size/8)),
        requests:[{setupRequest(request) {
          const i=actor++ % size;
          request.path="/inquiries/"+threads[Math.floor(i/2)]._id+"/messages";
          request.headers={authorization:"Bearer "+tokens[i]};
          return request;
        }}],
      });
      console.log(JSON.stringify({autocannonUsers:size, requests:result.requests.total,
        codes:result.statusCodeStats, errors:result.errors,timeouts:result.timeouts,latency:result.latency}));
      assert.equal(result.non2xx+result.errors+result.timeouts,0);
    }
    if (process.argv.includes("--integration")) {
      const path="/inquiries/"+threads[0]._id;
      // Installed APKs can omit clientMessageId. Exercise both participants typing concurrently.
      const burst = Array.from({length:12}, () => randomUUID());
      const repliesToBurst = await Promise.all(burst.map((text, index) =>
        call(index % 2, "legacySend", path + "/message", {text})));
      assert(repliesToBurst.every(reply => reply?.messages?.length === 1));
      const newest = await call(0, "history", path + "/messages");
      const older = await call(0, "history", path + "/messages?before=" + newest.nextBefore);
      const observed = [...older.messages, ...newest.messages].map(message => message.text);
      for (const text of burst) assert.equal(observed.filter(item => item === text).length, 1);
      console.log("PASS concurrent two-participant legacy sends and transcript pagination");
      const key=randomUUID(), payload={text:"retry fixture",clientMessageId:key};
      const replies=await Promise.all(Array.from({length:6},()=>call(0,"retry",path+"/message",payload)));
      assert(replies.every(r=>r?.messages?.[0]._id===replies[0]?.messages?.[0]._id && r));
      const row=await Inquiry.findById(threads[0]._id).lean();
      assert.equal(row.messages.filter(m=>m.text===payload.text).length,1);
      assert.equal(await Notification.countDocuments({messageId:replies[0].messages[0]._id}),1);
      const conflict = await fetch(base + path + "/message", { method: "POST",
        headers: { Authorization: "Bearer " + tokens[0], "Content-Type": "application/json" },
        body: JSON.stringify({ text: "different text", clientMessageId: key }) });
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).error, "Message key already used");
      console.log("PASS six overlapping retries persisted one message, queued one notification, and rejected a changed payload");
      const live = await call(1, "live", path + "/messages?live=1");
      assert.equal(typeof live.liveCursor, "string");
      assert.equal(live.messageCount, row.messages.length);
      const watchPath = path + "/messages?live=1&since=" + live.messageCount + "&watch=" + live.liveCursor;
      let resolved = false;
      const watch = call(1, "live", watchPath).then(page => { resolved = true; return page; });
      await sleep(200);
      assert.equal(resolved, false, "idle watch should wait for a committed message");
      const started = performance.now();
      const instantText = randomUUID();
      await call(0, "send", path + "/message", {text: instantText, clientMessageId: instantText});
      const change = await watch;
      const wakeMs = Math.round(performance.now() - started);
      assert.equal(change.messages[0]?.text, instantText);
      assert(change.liveCursor !== live.liveCursor);
      assert(performance.now() - started < 1500, "recipient should wake without waiting for push or periodic polling");
      const missing = await call(1, "live", path + "/messages?live=1&since=0");
      assert.equal(missing.messages.length, missing.messageCount);
      assert(missing.messages.length > 6);
      console.log("PASS foreground delivery after commit, catch-up beyond six messages, wake latency " + wakeMs + "ms");
      const batch = Array.from({length: 5}, () => ({ text: randomUUID(), clientMessageId: randomUUID() }));
      const sentBatch = await call(0, "batch", path + "/message", { batch });
      assert.deepEqual(sentBatch.messages.map(m => m.text), batch.map(m => m.text));
      const replayBatch = await call(0, "batch", path + "/message", { batch });
      assert.deepEqual(replayBatch.messages.map(m => m._id), sentBatch.messages.map(m => m._id));
      const caughtUp = await call(1, "live", path + "/messages?live=1&since=" + change.messageCount + "&watch=" + change.liveCursor);
      assert.deepEqual(caughtUp.messages.map(m => m.text), batch.map(m => m.text));
      console.log("PASS five queued messages and replay returned exactly five committed messages in order");
      const through=new Date().toISOString();
      await call(1,"ack",path+"/read",{through});
      await call(1,"ack",path+"/read",{through:new Date(1).toISOString()});
      assert.equal((await Inquiry.findById(row._id)).staffReadAt.toISOString(),through);
      await Promise.all([deliverNotifications(),deliverNotifications()]);
      const job=await Notification.findOne({messageId:replies[0].messages[0]._id});
      assert(job.deliveredAt);assert.equal(job.attempts,1);
      let limited=false;
      for(let i=0;i<182 && !limited;i++) {
        const r=await fetch(base+path+"/messages",{headers:{Authorization:"Bearer "+tokens[0]}});
        await r.text();limited=r.status===429;if(limited)assert(Number(r.headers.get("retry-after"))>0);
      }
      assert(limited);assert(await call(1,"poll",path+"/messages"));
      console.log("PASS concurrent idempotency, monotonic receipts, competing worker claims, account bucket isolation");
    }
  } finally {
    clearInterval(worker);while(draining)await sleep(100);
    await app.close();await mongoose.connection.dropDatabase();await mongoose.disconnect();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
