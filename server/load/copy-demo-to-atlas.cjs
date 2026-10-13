// Copy the exact 150 local demo listings and their six GridFS photos to Atlas.
// TARGET_DEMO_MONGO_URI is supplied in the process environment; never commit it.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const sourceUri = 'mongodb://127.0.0.1:27017/malikse';
const targetUri = process.env.TARGET_DEMO_MONGO_URI;
const publicOrigin = process.env.DEMO_PUBLIC_API_ORIGIN || 'https://malikse.onrender.com';
const execute = process.argv.includes('--execute');
if (!targetUri || !targetUri.startsWith('mongodb+srv://') || new URL(targetUri).pathname !== '/MAlikse') {
  throw Error('TARGET_DEMO_MONGO_URI must point to the explicitly requested Atlas MAlikse database');
}
if (!/^https:\/\/[a-z0-9.-]+$/i.test(publicOrigin)) throw Error('DEMO_PUBLIC_API_ORIGIN must be an HTTPS origin');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function readStream(stream) { const parts=[];for await(const part of stream) parts.push(part);return Buffer.concat(parts); }
async function main() {
  const source = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  let target;
  try {
    const owner = await source.db.collection('users').findOne({email:'demo-properties@malikse.invalid',role:'user'});
    assert.ok(owner,'Local demo owner missing');
    const listings = await source.db.collection('properties').find({ownerId:owner._id,title:/^DEMO · /}).sort({title:1}).toArray();
    assert.equal(listings.length,150,'Expected exactly 150 local demo listings');
    assert.equal(new Set(listings.map(row=>row.title)).size,150,'Local demo titles must be unique');
    const filenames = [...new Set(listings.flatMap(row=>(row.media?.photos||[]).map(url=>new URL(url).pathname.split('/').at(-1))))];
    assert.equal(filenames.length,6,'Expected six reusable demo images');
    const sourceBucket = new mongoose.mongo.GridFSBucket(source.db,{bucketName:'photos'});
    const photos=[];
    for(const filename of filenames){
      const file=await sourceBucket.find({filename}).next();assert.ok(file,`Missing local GridFS image ${filename}`);
      const bytes=await readStream(sourceBucket.openDownloadStream(file._id));assert.ok(bytes.length>10000);
      photos.push({filename,bytes,checksum:sha(bytes),contentType:file.contentType||'image/jpeg'});
    }
    target = await mongoose.createConnection(targetUri,{serverSelectionTimeoutMS:15000,maxPoolSize:10}).asPromise();
    const users=target.db.collection('users'),properties=target.db.collection('properties');
    const existingOwner=await users.findOne({email:'demo-properties@malikse.invalid',role:'user'});
    const existingDemo=await properties.find({title:/^DEMO · /}).project({ownerId:1,title:1}).toArray();
    const otherOwnerDemo=existingDemo.filter(row=>!existingOwner||String(row.ownerId)!==String(existingOwner._id));
    if(otherOwnerDemo.length) throw Error(`Atlas has ${otherOwnerDemo.length} demo-titled listings under another owner; refusing to duplicate them`);
    const existingTitles=new Set(existingDemo.map(row=>row.title));
    if(existingTitles.size!==existingDemo.length) throw Error('Atlas has duplicate demo titles; resolve these before copying');
    const targetBucket=new mongoose.mongo.GridFSBucket(target.db,{bucketName:'photos'});
    const existingPhotos=[];
    for(const photo of photos){
      const file=await targetBucket.find({filename:photo.filename}).next();
      if(file){const bytes=await readStream(targetBucket.openDownloadStream(file._id));if(sha(bytes)!==photo.checksum)throw Error(`Atlas image name collision: ${photo.filename}`);existingPhotos.push(photo.filename);}
    }
    console.log(JSON.stringify({mode:execute?'execute':'inspect',database:'Atlas MAlikse',sourceListings:listings.length,sourcePhotos:photos.length,existingAtlasDemoListings:existingDemo.length,existingAtlasPhotos:existingPhotos.length,newListingsExpected:listings.length-existingTitles.size,newPhotosExpected:photos.length-existingPhotos.length}));
    if(!execute)return;
    let targetOwner=existingOwner;
    if(!targetOwner){
      let mobile;
      for(let number=9876500000;number<9876500100;number++){if(!await users.findOne({mobile:String(number)},{projection:{_id:1}})){mobile=String(number);break;}}
      assert.ok(mobile,'No free demo owner mobile number');
      const {insertedId}=await users.insertOne({name:'MalikSe Demo Listings',email:'demo-properties@malikse.invalid',mobile,role:'user',demoKycComplete:true,isSuspended:false,isActive:true,createdAt:new Date(),updatedAt:new Date()});
      targetOwner={_id:insertedId};
    }else if(targetOwner.isSuspended===true||targetOwner.isActive===false){throw Error('Existing Atlas demo owner is disabled; refusing to publish listings under it');}
    for(const photo of photos){
      if(existingPhotos.includes(photo.filename))continue;
      const stream=targetBucket.openUploadStream(photo.filename,{contentType:photo.contentType,metadata:{demo:true}});
      await new Promise((resolve,reject)=>{stream.once('finish',resolve);stream.once('error',reject);stream.end(photo.bytes);});
    }
    let inserted=0,updated=0;
    for(const row of listings){
      const {_id,ownerId,...copy}=row;
      copy.ownerId=targetOwner._id;
      copy.media={...copy.media,photos:copy.media.photos.map(url=>`${publicOrigin}/property-photos/${new URL(url).pathname.split('/').at(-1)}`)};
      const result=await properties.updateOne({ownerId:targetOwner._id,title:row.title},{$set:copy},{upsert:true});
      if(result.upsertedCount)inserted++;else if(result.modifiedCount)updated++;
    }
    const copied=await properties.find({ownerId:targetOwner._id,title:/^DEMO · /}).toArray();
    assert.equal(copied.length,150,'Atlas demo listing total must be 150');
    assert.equal(new Set(copied.map(row=>row.title)).size,150);
    for(const row of copied){
      assert.equal(row.parcelPoints?.length,4,`Missing boundary: ${row.title}`);
      assert.ok(row.media?.photos?.[0]?.startsWith(publicOrigin+'/property-photos/'),`Invalid photo URL: ${row.title}`);
      assert.equal(row.status,'verified');
      assert.equal(row.badges?.fullyVerified,true);
    }
    console.log(JSON.stringify({copiedListings:copied.length,inserted,updated,verifiedImages:photos.length,verifiedBoundaries:copied.length}));
  } finally {await target?.close();await source.close();}
}
main().catch(error=>{console.error('Demo copy failed:',error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi,'mongodb+srv://[redacted]@'));process.exitCode=1;});
