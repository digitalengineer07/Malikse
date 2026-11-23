// Isolated replica set only. Example: node load/chat-burst.cjs 1000
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const { setTimeout: delay } = require("node:timers/promises");
const mongoose = require("mongoose");
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
const { createFastifyApp } = require("../dist/fastifyApp");
const { generateTokens } = require("../dist/services/security");
const { mongoPoolOptions } = require("../dist/services/mongoPool");
const { performanceMetrics, monitorPool } = require("../dist/services/performanceMetrics");
const { Inquiry } = require("../dist/models/Inquiry.model");
const { Property } = require("../dist/models/Property.model");
const { User } = require("../dist/models/User.model");
const { Notification } = require("../dist/models/Notification.model");

async function main() {
  const size = Number(process.argv[2] || 1000);
  assert(Number.isInteger(size) && size >= 2 && size <= 1000 && size % 2 === 0);
  await mongoose.connect("mongodb://127.0.0.1:27183/?replicaSet=chatbench", {
    dbName: "chatburst_" + randomUUID().replaceAll("-", ""), ...mongoPoolOptions(),
  });
  monitorPool(mongoose.connection.getClient());
  const app = createFastifyApp();
  const clients = Array.from({length:size}, () => new http.Agent({keepAlive:true, maxSockets:2, timeout:65000}));
  const spread = Number(process.argv[3] || 0);
  assert(Number.isFinite(spread) && spread >= 0 && spread <= 60000);
  const events = new Map();
  const statuses = {};
  try {
    await Promise.all([User, Property, Inquiry, Notification].map(m => m.init()));
    const users = await User.insertMany(Array.from({length:size}, (_, i) => ({
      name: "Local fixture " + i, mobile: String(9110000000 + i), passwordHash:"fixture",
      isVerifiedIdentity: true, role:i % 2 ? "advisor" : "user",
      ...(i % 2 ? { advisorCode: "FIXTURE" + i } : {}),
    })));
    const pairs = users.filter((_, i) => !(i % 2));
    const listings = await Property.insertMany(pairs.map((buyer, i) => ({
      ownerId:users[i*2+1]._id, assignedAdvisorId:users[i*2+1]._id, title:"Fixture", type:"land",
      location:{state:"Bihar",district:"Patna",lat:25,lng:85}, price:100,totalArea:10,sellableArea:10,status:"verified",
    })));
    const threads = await Inquiry.insertMany(pairs.map((buyer, i) => ({
      buyerId:buyer._id, staffId:users[i*2+1]._id, propertyId:listings[i]._id, message:"Fixture",
    })));
    const base = await app.listen({host:"127.0.0.1", port:0, backlog:2048});
    const tokens = users.map(u => generateTokens(u).accessToken);
    const call = async (i, name, suffix, body, thread = Math.floor(i/2)) => {
      const started = performance.now();
      const path = suffix === "/health" ? suffix : "/inquiries/" + threads[thread]._id + suffix;
      const {status,data} = await new Promise((resolve,reject) => {
        const request = http.request(base + path, {agent:clients[i], method:body ? "POST":"GET",
          signal:AbortSignal.timeout(45000), headers:{Authorization:"Bearer " + tokens[i], "Content-Type":"application/json"}}, response => {
          let payload = "";
          response.setEncoding("utf8");
          response.on("data", chunk => { payload += chunk; });
          response.on("error", reject);
          response.on("end", () => {
            try { resolve({status:response.statusCode,data:JSON.parse(payload)}); } catch (error) { reject(error); }
          });
        });
        request.on("error",reject);
        request.end(body && JSON.stringify(body));
      }).catch(error => ({status:error.code || error.name, data:{}}));
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(performance.now() - started);
      statuses[status] = (statuses[status] || 0) + 1;
      return {status, data};
    };
    // Stage connection establishment separately so the burst measures messaging
    // for already-connected phones, including a second socket for a held watch.
    const initial = [];
    for (let offset = 0; offset < size; offset += 16) {
      const cohort = users.slice(offset, offset + 16).map(async (_, j) => {
        const i = offset + j;
        const [page, health] = await Promise.all([call(i,"open","/messages?live=1"), call(i,"warm","/health")]);
        return health.status === 200 ? page : health;
      });
      initial.push(...await Promise.all(cohort));
    }
    assert(initial.every(r => r.status === 200), JSON.stringify(statuses));
    const watchers = users.map(async (_, i) => {
      await delay(4000 * i / size);
      return call(i, "watch", "/messages?live=1&since=0&watch=" + initial[i].data.liveCursor);
    });
    const watchesReady = Promise.allSettled(watchers);
    await delay(4500);
    const batches = users.map((_, i) => Array.from({length:5}, (_, n) => ({
      text:"fixture " + i + "/" + n, clientMessageId:randomUUID(),
    })));
    const sends = await Promise.all(users.map(async (_, i) => {
      if (spread) await delay(spread * i / size);
      return call(i, "burstSend", "/message", {batch:batches[i]});
    }));
    const watches = (await watchesReady).map(result => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    // Reconcile from the participants' last cursor. An early watch may return part of the burst.
    const refresh = await Promise.all(users.map((_, i) => call(i, "catchUp", "/messages?live=1&since=0")));
    const rows = await Inquiry.find().select("messages").lean();
    const unique = new Set(rows.flatMap(r => r.messages.map(m => m.text))).size;
    const persisted = rows.reduce((sum, r) => sum+r.messages.length, 0);
    let notifications = 0;
    for (let i = 0; i < 20; i++) {
      notifications = await Notification.countDocuments({messageId:{$exists:true}});
      if (notifications === persisted) break;
      await delay(100);
    }
    const latency = Object.fromEntries([...events].map(([phase, samples]) => {
      samples.sort((a,b)=>a-b);
      const ms = p => Math.round(samples[Math.ceil(samples.length*p)-1]);
      return [phase,{count:samples.length,p50:ms(.5),p95:ms(.95),p99:ms(.99)}];
    }));
    console.log("CHAT_BURST_RESULT " + JSON.stringify({users:size,threads:threads.length,sendWindowMs:spread,persisted,unique,
      notifications,statuses, fallback:watches.filter(r=>r.data.canWait===false).length,
      poolFailures:performanceMetrics.poolFailures,latency}));
    assert.equal(persisted, size*5);
    assert.equal(unique, persisted);
    assert.equal(notifications, persisted);
    for (const [i, r] of sends.entries()) {
      assert.equal(r.status, 200);
      assert.deepEqual(r.data.messages.map(m=>m.text), batches[i].map(m=>m.text));
      assert.equal(refresh[i].data.messageCount, 10);
    }
    assert.deepEqual(Object.keys(statuses), ["200"]);
    const first = {text:"shared key",clientMessageId:randomUUID()};
    const more = Array.from({length:6},(_, i) => ({text:"overlap " + i,clientMessageId:randomUUID()}));
    const replays = await Promise.all(more.map(item => call(0,"overlap","/message",{batch:[first,item]})));
    assert(replays.every(r => r.status === 200));
    assert.equal(new Set(replays.map(r => r.data.messages[0]._id)).size,1);
    const conflict = await call(0,"conflict","/message",{batch:[{...first,text:"changed"}, {text:"invalid remainder",clientMessageId:randomUUID()}]});
    assert.equal(conflict.status,409);
    if (size > 2) {
      assert.equal((await call(2,"outsider","/message",{text:"forbidden"},0)).status,403);
    }
    const thread = await Inquiry.findById(threads[0]._id).lean();
    assert.equal(thread.messages.length,17);
    assert.equal(thread.messages.filter(row => row.text === first.text).length,1);
    let alerts = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      alerts = await Notification.countDocuments({"data.id":String(thread._id)});
      if (alerts === 17) break;
      await delay(100);
    }
    assert.equal(alerts,17);
    await User.updateOne({_id:users[0]._id},{ $set:{isVerifiedIdentity:false} });
    assert.equal((await call(0,"kyc","/message",{text:"unverified"})).status,403);
    await Property.updateOne({_id:listings[0]._id},{ $set:{status:"sold"} });
    assert.equal((await call(1,"readOnly","/message",{text:"sold property"})).status,409);
    console.log("CHAT_RETRY_CHECK passed");
  } finally {
    clients.forEach(client => client.destroy());
    await app.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
