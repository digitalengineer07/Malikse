// Functional guards for performance changes; exclusively uses a disposable local DB.
const assert = require('assert/strict');
const { randomUUID } = require('crypto');
process.env.JWT_ACCESS_SECRET = randomUUID(); process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.NODE_ENV = 'development'; process.env.REQUEST_LOGS = 'false';
const mongoose = require('mongoose');
const { createApp } = require('../dist/app');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { Inquiry } = require('../dist/models/Inquiry.model');
const { generateTokens } = require('../dist/services/security');
const { searchProperties } = require('../dist/services/propertySearch');
const db = 'malikse_performance_test_' + randomUUID().replaceAll('-', '');
let server;
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/' + db);
  const users = await User.create(['admin','user','user','user'].map((role,i)=>({role,name:'Fixture '+i,mobile:String(9300000000+i),passwordHash:'fixture',demoKycComplete:true})));
  const tokens = users.map(u=>generateTokens(u).accessToken);
  const properties = await Property.insertMany(Array.from({length:125},(_,i)=>({ownerId:users[1]._id,title:'Property '+i,type:'land',location:{state:'Bihar',district:'Patna',lat:25,lng:85},price:100000,totalArea:1000,sellableArea:900,status:'verified',badges:{fullyVerified:true},advisorReview:{decision:'approve'},verifierReview:{decision:'approve'}})));
  const records = await Inquiry.insertMany(Array.from({length:61},(_,i)=>({propertyId:properties[0]._id,buyerId:users[2]._id,sellerId:users[1]._id,message:'Hello',messages:Array.from({length:75},(_,j)=>({senderId:j===74?users[1]._id:users[2]._id,text:'message '+j,createdAt:new Date(Date.now()-10000+j)})),sellerReadAt:new Date(0)})));
  server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(route,actor=0,body) {const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+tokens[actor],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),next:r.headers.get('x-next-cursor')};}
  let cursor, all=[];
  do {const r=await request('/admin/properties?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(r.status,200);assert.ok(r.data.length<=50);all.push(...r.data);cursor=r.next;} while(cursor);
  assert.equal(all.length,125);assert.equal(new Set(all.map(x=>x._id)).size,125);
  assert.equal((await request('/admin/properties?cursor=bad')).status,400);
  assert.equal((await request('/admin/properties?limit=1000')).status,400);
  assert.equal((await request('/admin/properties',3)).status,403);
  const first=await searchProperties({limit:'50'}), second=await searchProperties({limit:'50',cursor:first.nextCursor});
  assert.equal(new Set([...first.results,...second.results].map(x=>String(x._id))).size,100);
  await User.updateOne({_id:users[1]._id},{$set:{isSuspended:true}});
  assert.equal((await searchProperties({limit:'50'})).results.length,0);
  await User.updateOne({_id:users[1]._id},{$set:{isSuspended:false}});
  const inbox=await request('/inquiries',1);assert.equal(inbox.status,200);assert.equal(inbox.data.length,50);assert.ok(inbox.next);
  assert.equal(inbox.data[0].messages.length,1);assert.equal(inbox.data[0].unread,true); // Latest is outgoing; older incoming is still unread.
  const id=String(records[0]._id);
  const messages=await request('/inquiries/'+id+'/messages',1);assert.equal(messages.data.messages.length,50);assert.equal(messages.data.nextBefore,25);
  const older=await request('/inquiries/'+id+'/messages?before=25',1);assert.equal(older.data.messages.length,25);assert.equal(older.data.nextBefore,null);
  assert.equal(new Set([...messages.data.messages,...older.data.messages].map(x=>x._id)).size,75);
  assert.equal((await request('/inquiries/'+id+'/messages',3)).status,404);
  const writes=await Promise.all(Array.from({length:10},(_,i)=>request('/inquiries/'+id+'/message',2,{text:'concurrent '+i})));
  assert.ok(writes.every(r=>r.status===200 && r.data.messages.length===1));
  assert.equal((await Inquiry.findById(id).lean()).messages.length,85);
  // Cursor offsets do not shift when new messages are appended.
  assert.equal((await request('/inquiries/'+id+'/messages?before=25',1)).data.messages.length,25);
  const toggles = await Promise.all(Array.from({length:10},()=>request('/users/wishlist/'+properties[0]._id,2,{})));
  assert.ok(toggles.every(r=>r.status===200));
  assert.equal((await User.findById(users[2]._id).lean()).wishlist.length,0);
  await User.updateOne({_id:users[2]._id},{$set:{wishlist:properties.map(p=>p._id)}});
  let savedCursor, saved=[];
  do { const page=await request('/users/wishlist'+(savedCursor?'?cursor='+encodeURIComponent(savedCursor):''),2); assert.equal(page.status,200); saved.push(...page.data); savedCursor=page.next; } while(savedCursor);
  assert.deepEqual(saved.map(p=>p._id),properties.map(p=>String(p._id)).reverse());
  console.log('PASS: bounded lists, complete cursor traversal, invalid cursors, role checks, live cache revocation, summary unread accuracy, message paging/authorization and concurrent append without lost messages');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(mongoose.connection.name===db){await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
