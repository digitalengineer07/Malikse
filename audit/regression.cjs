// Run from any directory: node audit/regression.cjs
// Tests use real Express routes and a unique temporary MongoDB database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'server/package.json'));
req('dotenv').config({ path: path.join(root, 'server/.env') });
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.PUBLIC_API_URL = 'https://api.example.test';
req('ts-node').register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
const mongoose = req('mongoose');
const express = req('express');
const bcrypt = req('bcryptjs');
const { User } = require('../server/src/models/User.model');
const { Property } = require('../server/src/models/Property.model');
const { Deal } = require('../server/src/models/Deal.model');
const { Inquiry } = require('../server/src/models/Inquiry.model');
const { PropertyDocument } = require('../server/src/models/Document.model');
const { processNextSubmission } = require('../server/src/services/submissionQueue');
const { availableStaff } = require('../server/src/services/propertyWorkflow');
const { generateTokens, tokenDigest } = require('../server/src/services/security');
const { inquiryActivity } = require('../app/src/utils/inquiryActivity');
let checks = 0;
const passed = [];
function pass(name) { passed.push(name); console.log('PASS: ' + name); }

async function main() {
  const dbName = 'malikse_security_test_' + randomUUID().replaceAll('-', '');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/malikse', { dbName });
    const app = express(); app.use(express.json());
    for (const [url, file] of [['auth','auth'],['users','user'],['properties','property'],['inquiries','inquiry'],['admin','admin'],['deals','deal'],['documents','document'],['verification','advisor'],['property-photos','photo']]) {
      app.use('/' + url, require('../server/src/routes/' + file + '.routes').default);
    }
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const call = async (url, token, body, expected = 200, method = body ? 'POST' : 'GET') => {
      const response = await fetch(base + url, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
      if (url.endsWith("/submit") && expected === 200) {
        assert.equal(response.status,202); assert.equal(data.status,"queued");
        await processNextSubmission(); checks++;
        return JSON.parse(JSON.stringify(await Property.findById(data._id)));
      }
      assert.equal(response.status, expected, method + ' ' + url + ': ' + text); checks++;
      return data;
    };
    const password = 'audit-only-password';
    const passwordHash = await bcrypt.hash(password, 4);
    const seller = await User.create({name:'Audit Seller',mobile:'9100000001',role:'user',passwordHash,demoKycComplete:true});
    const buyer = await User.create({name:'Audit Buyer',mobile:'9100000002',role:'user',passwordHash});
    const admin = await User.create({name:'Audit Admin',mobile:'9100000003',role:'admin',passwordHash});
    const inactive = await User.create({name:'Inactive Advisor',mobile:'9100000004',role:'advisor',passwordHash,isActive:false});
    const active = await User.create({name:'Active Advisor',mobile:'9100000005',role:'advisor',passwordHash});
    const st=generateTokens(seller).accessToken, bt=generateTokens(buyer).accessToken, at=generateTokens(admin).accessToken;
    const input={ownerId:seller._id,type:'land',title:'Audit property',location:{state:'Bihar',district:'Patna',lat:25.6,lng:85.1},price:100000,totalArea:1000,sellableArea:900,media:{photos:['https://example.test/photo.jpg']},status:'draft',advisorReview:{decision:'approve',notes:'PRIVATE_REVIEW'},verifierReview:{decision:'approve'},verificationHistory:[{actorId:String(inactive._id),action:'approve',role:'advisor'}]};
    const property = await Property.create(input);
    const published = await Property.create({...input,status:'verified',badges:{fullyVerified:true}});

    for(const filename of ['..%2Fprivate.txt','..%5Cprivate.txt','..%2F..%2Fsrc%2Findex.ts','not-an-image.jpg']) await call('/property-photos/'+filename,undefined,undefined,404);
    const photoForm = new FormData();
    photoForm.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZf8AAAAASUVORK5CYII=','base64')]), 'fixture.png');
    const photoResponse=await fetch(base+'/properties/'+property._id+'/photos',{method:'POST',headers:{Authorization:'Bearer '+st},body:photoForm});
    assert.equal(photoResponse.status,201);
    const photo = await photoResponse.json();
    assert.equal(new URL(photo.url).origin,'https://api.example.test');
    const image=await fetch(base+new URL(photo.url).pathname);assert.equal(image.status,200);assert.ok((await image.arrayBuffer()).byteLength>0);
    pass('Photo traversal rejected; normal photo upload/download works');

    await call('/users/wishlist/'+property._id,bt,{},404);
    await call('/users/wishlist/'+published._id,bt,{});
    await User.updateOne({_id:buyer._id},{$push:{wishlist:property._id}}); // Legacy/private saved entry.
    let list=await call('/users/wishlist',bt);
    assert.equal(list.length,1); assert.equal(list[0]._id,String(published._id));
    for(const key of ['ownerId','advisorReview','verifierReview','verificationHistory','documents']) assert.equal(list[0][key],undefined);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:true}});
    assert.equal((await call('/users/wishlist',bt)).length,0);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:false}});
    pass('Wishlist requires publication, filters suspended owners and excludes private fields');

    await call('/inquiries',bt,{propertyId:published._id,message:'Hello',offerAmount:100},403);
    await call('/auth/kyc/demo',bt,{});
    await call('/inquiries',bt,{propertyId:property._id,message:'Hello',offerAmount:100},409);
    await call('/inquiries',at,{propertyId:published._id,message:'Hello',offerAmount:100},403);
    await call('/inquiries',bt,{propertyId:published._id,message:'Hello',offerAmount:-100},400);
    await call('/inquiries',bt,{propertyId:published._id,message:'Hello',offerAmount:'100'},400);
    await call('/inquiries',bt,{propertyId:published._id,message:'   ',offerAmount:100},400);
    await call('/inquiries',st,{propertyId:published._id,message:'Hello',offerAmount:100},400);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:true}});
    await call('/inquiries',bt,{propertyId:published._id,message:'Hello',offerAmount:100},409);
    await call('/deals/'+published._id+'/offer',bt,{amount:100},409);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:false}});
    const inquiry=await call('/inquiries',bt,{propertyId:published._id,message:'Hello',offerAmount:100},201);
    assert.equal((await call('/inquiries/sent',bt))[0].sellerId.mobile,undefined);
    pass('Inquiry and deal eligibility enforced; contact details stay private');

    const login=await call('/auth/login',undefined,{mobile:buyer.mobile,password});
    const first=await call('/auth/refresh',undefined,{refreshToken:login.refreshToken});
    assert.notEqual(first.refreshToken,login.refreshToken);
    await call('/auth/refresh',undefined,{refreshToken:login.refreshToken},401);
    const responses=await Promise.all([200,401].map(()=>fetch(base+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:first.refreshToken})})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);
    const winner=await responses.find(r=>r.status===200).json();
    assert.equal((await User.findById(buyer._id)).refreshTokenHash,tokenDigest(winner.refreshToken));
    await call('/auth/logout',winner.accessToken,{});
    await call('/auth/refresh',undefined,{refreshToken:winner.refreshToken},401);
    await User.updateOne({_id:buyer._id},{$set:{refreshTokenHash:await bcrypt.hash(winner.refreshToken,4)}});
    await call('/auth/refresh',undefined,{refreshToken:winner.refreshToken},401);
    pass('Refresh tokens are unique, rotate once atomically and reject replay/legacy hashes/logout');

    let profile=await call('/users/profile',bt,{name:'  Renamed Buyer  ',email:' TEST@EXAMPLE.COM '},200,'PUT');
    assert.equal(profile.id,String(buyer._id));assert.equal(profile.name,'Renamed Buyer');assert.equal(profile.email,'test@example.com');assert.equal(profile.passwordHash,undefined);
    for(const body of [{name:''},{name:' '},{email:'not-email'},{name:9}]) await call('/users/profile',bt,body,400,'PUT');
    profile=await call('/users/profile',bt);assert.equal(profile.id,String(buyer._id));
    pass('Profile DTO preserves id and validates name/email');

    assert.equal(String(await availableStaff('advisor')),String(active._id));
    assert.equal(String(await availableStaff('advisor',inactive._id)),String(active._id));
    const pending=await Property.create({...input,status:'pending',assignedAdvisorId:active._id});
    await call('/admin/properties/'+pending._id+'/assign',at,{staffId:inactive._id},400);
    await call('/admin/staff/'+active._id+'/status',at,{},200,'PUT');
    assert.equal((await Property.findById(pending._id)).assignedAdvisorId,undefined);
    assert.equal(await availableStaff('advisor'),undefined);
    await call('/admin/staff/'+active._id+'/status',at,{},200,'PUT');
    const correction=await Property.create({...input,status:'correction_required',assignedAdvisorId:inactive._id});
    const submitted=await call('/properties/'+correction._id+'/submit',st,{consent:true});
    assert.equal(submitted.assignedAdvisorId,String(active._id));
    pass('Inactive staff excluded from automatic/manual/resubmission assignment; deactivation releases pending work');

    const deal=await Deal.create({propertyId:published._id,buyerId:buyer._id,ownerId:seller._id,offerAmount:100000,commissionAmount:1180,status:'completed'});
    const buyerDeal=await call('/deals/'+deal._id,bt);
    assert.equal(buyerDeal.propertyId.advisorReview,undefined);assert.equal(buyerDeal.propertyId.verificationHistory,undefined);
    assert.equal((await call('/deals/'+deal._id,st)).propertyId.advisorReview.notes,'PRIVATE_REVIEW');
    await call('/deals/'+deal._id+'/status',st,{status:'rejected'},409,'PATCH');
    await call('/deals/'+deal._id+'/status',at,{status:'accepted'},409,'PATCH');
    const offered=await call('/deals/'+published._id+'/offer',bt,{amount:110000},201);
    const transitions=await Promise.all(['accepted','rejected'].map(status=>fetch(base+'/deals/'+offered._id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+st},body:JSON.stringify({status})})));
    assert.deepEqual(transitions.map(r=>r.status).sort(),[200,409]);
    pass('Deal buyers receive public fields; terminal and concurrent transitions are protected');
    assert.equal((await call('/admin/users/'+seller._id+'/transactions',at)).deals.length,2);
    assert.ok((await call('/admin/staff/'+inactive._id+'/workload',at)).history.some(p=>p._id===String(property._id)));
    assert.equal((await call('/admin/properties/'+property._id+'/audit',at)).verificationHistory[0].action,'approve');
    pass('Admin seller transactions, staff history and property audits use actual schema fields');

    const fd=new FormData();fd.append('propertyId',String(property._id));fd.append('type','Registry');fd.append('file',new Blob(['AUDIT_DOCUMENT']),'audit.txt');
    const upload=await fetch(base+'/documents',{method:'POST',headers:{Authorization:'Bearer '+st},body:fd});assert.equal(upload.status,201);
    let docs=await call('/documents?propertyId='+property._id,st);
    const link=new URL(docs[0].fileUrl);assert.equal(link.origin,'https://api.example.test');
    assert.equal((await fetch(base+link.pathname+link.search)).status,200);
    await call(link.pathname,undefined,undefined,403);
    const stored=await PropertyDocument.findById(docs[0]._id);
    await call('/property-photos/..%2F'+stored.fileUrl,undefined,undefined,404);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:true}});
    await call(link.pathname+link.search,undefined,undefined,403);
    await User.updateOne({_id:seller._id},{$set:{isSuspended:false}});
    await Property.updateOne({_id:property._id},{$set:{assignedAdvisorId:active._id}});
    docs=await call('/documents?propertyId='+property._id,generateTokens(active).accessToken);
    const staffLink=new URL(docs[0].fileUrl);
    await User.updateOne({_id:active._id},{$set:{isActive:false}});
    await call(staffLink.pathname+staffLink.search,undefined,undefined,403);
    pass('Document URLs use configured HTTPS origin; missing authorization and disabled actors denied');

    let received=(await call('/inquiries/received',st))[0];
    assert.equal(inquiryActivity(received,String(seller._id)).unread,true);
    await call('/inquiries/'+inquiry._id+'/read',st,{through:received.createdAt});
    received=(await call('/inquiries/received',st))[0];assert.equal(inquiryActivity(received,String(seller._id)).unread,false);
    const message=await call('/inquiries/'+inquiry._id+'/message',bt,{text:'Latest incoming message'});
    const through=message.messages.at(-1).createdAt;
    received=(await call('/inquiries/received',st))[0];
    const activity=inquiryActivity(received,String(seller._id));
    assert.equal(activity.lastMsg,'Latest incoming message');assert.equal(activity.timestampNum,Date.parse(through));assert.equal(activity.unread,true);
    await call('/inquiries/'+inquiry._id+'/read',at,{through},404);
    await call('/inquiries/'+inquiry._id+'/read',st,{through:'invalid'},400);
    await call('/inquiries/'+inquiry._id+'/read',st,{through:new Date(Date.now()+60000).toISOString()},400);
    await call('/inquiries/'+inquiry._id+'/read',st,{through});
    await call('/inquiries/'+inquiry._id+'/read',st,{through:received.createdAt});
    received=(await call('/inquiries/received',st))[0];assert.equal(inquiryActivity(received,String(seller._id)).unread,false);
    assert.equal(new Date((await Inquiry.findById(inquiry._id)).sellerReadAt).getTime(),Date.parse(through));
    pass('Latest-message previews and unread state persist, remain actor-scoped and never move backwards');

    const bootstrap=`require(${JSON.stringify(req.resolve('ts-node'))}).register({project:${JSON.stringify(path.join(root,'server/tsconfig.json'))},transpileOnly:true});require(${JSON.stringify(path.join(root,'server/src/services/security.ts'))});`;
    for(const [name, env] of [
      ['missing access secret',{JWT_ACCESS_SECRET:''}],
      ['known fallback',{JWT_ACCESS_SECRET:'dev_access_secret'}],
      ['same secrets',{JWT_REFRESH_SECRET:process.env.JWT_ACCESS_SECRET}],
      ['missing production origin',{NODE_ENV:'production',PUBLIC_API_URL:''}],
      ['HTTP production origin',{NODE_ENV:'production',PUBLIC_API_URL:'http://api.example.test'}],
    ]) {
      const child=spawnSync(process.execPath,['-e',bootstrap],{env:{...process.env,...env},encoding:'utf8'});
      assert.notEqual(child.status,0,name);checks++;
    }
    pass('Startup fails closed for missing/known/shared JWT secrets and unsafe production origin');
    console.log(`Security regression passed: ${checks} HTTP/configuration checks plus model and UI activity assertions.`);
  } finally {
    if(mongoose.connection.name===dbName) {
      for(const doc of await PropertyDocument.find()) {
        const filename=path.basename(doc.fileUrl);
        if(/^[a-f0-9-]+\.txt$/i.test(filename)) fs.rmSync(path.join(root,'server/uploads',filename),{force:true});
      }
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if(server) await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify({checks,passed},null,2)+'\n');
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
