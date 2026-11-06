const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.PUBLIC_API_URL = 'http://localhost:5000';
process.env.NODE_ENV = 'development';
const mongoose = require('mongoose');
const express = require('express');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { PropertyDocument } = require('../dist/models/Document.model');
const { generateTokens } = require('../dist/services/security');

async function main() {
  const dbName = 'malikse_upload_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27017/' + dbName);
  const app = express();
  app.use('/properties', require('../dist/routes/property.routes').default);
  app.use('/documents', require('../dist/routes/document.routes').default);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const owner = await User.create({ name: 'Upload test', mobile: '9200000000', role: 'user', passwordHash: 'test-fixture', demoKycComplete: true });
    const token = generateTokens(owner).accessToken;
    const p = await Property.create({ ownerId: owner._id, type: 'land', price: 100, totalArea: 100, sellableArea: 100, location: { state: 'Bihar', district: 'Patna', lat: 25, lng: 85 } });
    const send = async (photo, uploadId) => {
      const body = new FormData();
      body.append('uploadId', uploadId);
      if (!photo) { body.append('propertyId', String(p._id)); body.append('type', 'Registry'); }
      body.append('file', new Blob([Buffer.from([255,216,255,1,2,3])], { type: 'image/jpeg' }), 'test.jpg');
      const response = await fetch(base + (photo ? `/properties/${p._id}/photos` : '/documents'), { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body });
      const data = await response.json();
      assert.ok([200,201].includes(response.status), JSON.stringify(data));
      return data;
    };
    const photoId = randomUUID();
    const [a,b] = await Promise.all([send(true, photoId), send(true, photoId)]);
    assert.equal(a.url,b.url);
    assert.equal((await send(true, photoId)).url,a.url);
    assert.equal((await Property.findById(p._id)).media.photos.length,1);
    assert.equal(await mongoose.connection.db.collection('photos.files').countDocuments(),1);
    await Property.updateOne({_id:p._id},{$set:{'media.photos':[]}});
    await send(true,photoId);
    assert.equal((await Property.findById(p._id)).media.photos.length,1);
    const docId = randomUUID();
    const [c,d] = await Promise.all([send(false,docId),send(false,docId)]);
    assert.equal(c._id,d._id);
    assert.equal((await send(false,docId))._id,c._id);
    await Promise.all([send(false,randomUUID()),send(false,randomUUID())]);
    assert.equal(await PropertyDocument.countDocuments(),3);
    assert.equal((await Property.findById(p._id)).documents.length,3);
    // Simulate a process interruption after saving a document, before attachment.
    await Property.updateOne({_id:p._id},{$pull:{documents:c._id}});
    await send(false,docId);
    assert.equal((await Property.findById(p._id)).documents.length,3);
    console.log('PASS: simultaneous duplicate photos/documents, lost-response replay, parallel document attachment and interrupted attachment recovery');
  } finally {
    for (const doc of await PropertyDocument.find().lean()) {
      await fs.rm(path.resolve(__dirname,'../uploads',path.basename(doc.fileUrl)),{force:true});
    }
    await new Promise(r => server.close(r));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
