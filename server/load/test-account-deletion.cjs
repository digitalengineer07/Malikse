const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.REQUEST_LOGS = 'false';
const mongoose = require('mongoose');
const express = require('express');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { PropertyDocument } = require('../dist/models/Document.model');
const { Deal } = require('../dist/models/Deal.model');
const { Inquiry } = require('../dist/models/Inquiry.model');
const { AccountDeletion } = require('../dist/models/AccountDeletion.model');
const { SearchPreference } = require('../dist/models/SearchPreference.model');
const { Engagement } = require('../dist/models/Engagement.model');
const { Notification } = require('../dist/models/Notification.model');
const { PushDevice } = require('../dist/models/PushDevice.model');
const { PushReceipt } = require('../dist/models/PushReceipt.model');
const { PasswordReset } = require('../dist/models/PasswordReset.model');
const { Registration } = require('../dist/models/Registration.model');
const { DocumentDownload } = require('../dist/models/DocumentDownload.model');
const { requestAccountDeletion, processAccountDeletion } = require('../dist/services/accountDeletion');
const { stopRegionCounts } = require('../dist/services/regionCountStore');
const { generateTokens } = require('../dist/services/security');
const { authenticateRequest } = require('../dist/middleware/auth.middleware');
const passwords = require('../dist/services/passwords').default;
const dbName = 'malikse_deletion_test_' + randomUUID().replaceAll('-', '');
let server;
const localFiles = [];
async function main() {
  const replica = process.argv.includes('--replica');
  await mongoose.connect(replica ? 'mongodb://127.0.0.1:27028/' + dbName + '?replicaSet=workflow-test' : 'mongodb://127.0.0.1:27017/' + dbName, { serverSelectionTimeoutMS: 3000 });
  await AccountDeletion.init();
  const password = 'Delete!Forest82';
  const hash = await passwords.hash(password, 4);
  const [owner, buyer, admin] = await User.create([
    { name: 'Deletion Owner', role: 'user', email: 'delete@example.test', passwordHash: hash, isVerifiedIdentity: true },
    { name: 'Other Buyer', role: 'user', email: 'keep@example.test', passwordHash: hash },
    { name: 'Admin', role: 'admin', email: 'admin@example.test', passwordHash: hash },
  ]);
  const baseProperty = { type: 'land', title: 'Private listing', price: 1000, totalArea: 100, sellableArea: 90, location: { state: 'Bihar', district: 'Patna', lat: 25, lng: 85 }, status: 'verified', badges: { fullyVerified: true }, advisorReview: { decision: 'approve' } };
  const prop = await Property.create({ ...baseProperty, ownerId: owner._id });
  const other = await Property.create({ ...baseProperty, ownerId: buyer._id, jointOwnerIds: [owner._id] });
  const bucket = name => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: name });
  async function upload(name, filename, metadata) {
    const stream = bucket(name).openUploadStream(filename, { metadata });
    await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); stream.end(Buffer.from('private fixture bytes')); });
    return stream.id;
  }
  const kycId = await upload('kyc', 'identity', { ownerId: String(owner._id) });
  await User.updateOne({ _id: owner._id }, { $set: { kycDocuments: [String(kycId)], wishlist: [other._id] } });
  const ownPhoto = randomUUID() + '.jpg', sharedPhoto = randomUUID() + '.jpg';
  await upload('photos', ownPhoto, { propertyId: prop._id });
  await upload('photos', sharedPhoto, { propertyId: prop._id });
  const ownUrl = 'https://example.test/property-photos/' + ownPhoto, sharedUrl = 'https://example.test/property-photos/' + sharedPhoto;
  await Property.updateOne({ _id: prop._id }, { $set: { 'media.photos': [ownUrl, sharedUrl] } });
  await Property.updateOne({ _id: other._id }, { $set: { 'media.photos': [sharedUrl] } });
  const fileName = randomUUID() + '.pdf';
  const local = path.join(__dirname, '../uploads', fileName); localFiles.push(local);
  await fs.mkdir(path.dirname(local), { recursive: true }); await fs.writeFile(local, '%PDF-private');
  const doc = await PropertyDocument.create({ propertyId: prop._id, uploadedBy: owner._id, fileName: 'private.pdf', fileUrl: fileName, fileSize: 12, type: 'Registry' });
  await DocumentDownload.create({ _id: 'test-ticket', documentId: doc._id, actorId: owner._id, expiresAt: new Date(Date.now() + 60000) });
  const deal = await Deal.create({ propertyId: prop._id, buyerId: buyer._id, ownerId: owner._id, offerAmount: 1000, commissionAmount: 10, status: 'offered', history: [{ terms: 'private owner data' }] });
  await Inquiry.create({ propertyId: prop._id, buyerId: buyer._id, staffId: admin._id, message: 'Private conversation' });
  await SearchPreference.create({ userId: owner._id, searches: [] });
  await Engagement.create({ propertyId: other._id, actor: createHash('sha256').update(String(owner._id)).digest('hex'), kind: 'view', day: '2026-11-07' });
  await Notification.create({ recipient: owner._id, title: 'Private' });
  const token = 'ExponentPushToken[account_deletion_test]';
  await PushDevice.create({ userId: owner._id, token, platform: 'android' });
  await PushReceipt.create({ token, ticketId: 'test-ticket' });
  await Registration.collection.insertOne({ _id: owner.email, email: owner.email, deleteAt: new Date(Date.now() + 100000) });
  await PasswordReset.collection.insertOne({ _id: String(owner._id), userId: owner._id });
  const access = generateTokens(owner).accessToken;
  const app = express(); app.set('trust proxy', 'loopback'); app.use(express.json()); app.use('/account-deletion', require('../dist/routes/accountDeletion.routes').default);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  let count = 0;
  async function call(route, body, ip) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/account-deletion${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip || `192.0.2.${++count}` }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const payload = { identifier: owner.email, password, confirmation: 'DELETE', userId: buyer._id };
  assert.equal((await call('', { ...payload, password: 'wrong' })).status, 401);
  assert.equal((await call('', { ...payload, confirmation: 'NO' })).status, 400);
  assert.equal((await call('', { ...payload, identifier: admin.email })).status, 403);
  const [first, duplicate] = await Promise.all([call('', payload), call('', payload)]);
  assert.equal(first.status, 202); assert.equal(duplicate.status, 202);
  assert.equal(first.data.reference, duplicate.data.reference);
  assert.equal(await AccountDeletion.countDocuments({ userId: owner._id }), 1);
  assert.equal((await authenticateRequest('Bearer ' + access)).status, 403);
  assert.equal((await User.findById(buyer._id)).isActive, true);
  assert.equal((await call('/status', { ...first.data, receipt: '0'.repeat(64) })).status, 404);
  assert.equal((await call('/status', first.data)).data.status, 'pending');
  if (replica) {
    const staff = await User.create({ name: 'Assigned staff', role: 'advisor', passwordHash: hash });
    await Property.updateOne({ _id: prop._id }, { $set: { assignedAdvisorId: staff._id } });
    const { changeDeal } = require('../dist/services/dealWorkflow');
    await assert.rejects(changeDeal(String(deal._id), { id: String(admin._id), role: 'admin' }, { status: 'accepted' }), /being deleted/);
    assert.equal((await Deal.findById(deal._id)).status, 'offered');
    console.log('PASS: transaction refuses acceptance for an owner awaiting deletion');
  }
  // Accepted deals defer cleanup and keep bytes until staff resolve the obligation.
  await Deal.updateOne({ _id: deal._id }, { $set: { status: 'accepted' } });
  await AccountDeletion.updateOne({ _id: first.data.reference }, { $set: { nextAttemptAt: new Date(0) } });
  await processAccountDeletion();
  assert.equal((await AccountDeletion.findById(first.data.reference)).status, 'awaiting_deals');
  assert.ok(await User.exists({ _id: owner._id }));
  await Deal.updateOne({ _id: deal._id }, { $set: { status: 'cancelled' } });
  // Simulate failure after some bytes are removed, then verify a fresh attempt repairs it.
  const originalDelete = Property.deleteOne;
  Property.deleteOne = () => { throw new Error('simulated database interruption'); };
  await AccountDeletion.updateOne({ _id: first.data.reference }, { $set: { nextAttemptAt: new Date(0) } });
  try { await processAccountDeletion(); } finally { Property.deleteOne = originalDelete; }
  assert.equal((await AccountDeletion.findById(first.data.reference)).status, 'pending');
  await AccountDeletion.updateOne({ _id: first.data.reference }, { $set: { nextAttemptAt: new Date(0) } });
  await Promise.all([processAccountDeletion(), processAccountDeletion()]);
  const completed = await AccountDeletion.findById(first.data.reference).lean();
  assert.equal(completed.status, 'completed'); assert.equal(completed.userId, undefined); assert.equal(completed.email, undefined);
  assert.ok(completed.expiresAt); assert.equal(await User.findById(owner._id), null);
  assert.equal((await authenticateRequest('Bearer ' + access)).status, 401);
  assert.equal(await Property.findById(prop._id), null); assert.ok(await Property.findById(other._id));
  assert.equal((await Property.findById(other._id)).jointOwnerIds.length, 0);
  assert.equal(await mongoose.connection.db.collection('kyc.files').countDocuments(), 0);
  assert.equal(await mongoose.connection.db.collection('kyc.chunks').countDocuments(), 0);
  assert.equal(await bucket('photos').find({ filename: ownPhoto }).next(), null);
  assert.ok(await bucket('photos').find({ filename: sharedPhoto }).next());
  assert.equal((await bucket('photos').find({ filename: sharedPhoto }).next()).metadata?.propertyId, undefined);
  await assert.rejects(fs.stat(local), { code: 'ENOENT' });
  for (const model of [PropertyDocument, Inquiry, SearchPreference, Engagement, Notification, PushDevice, PushReceipt, Registration, PasswordReset, DocumentDownload]) assert.equal(await model.countDocuments(), 0, model.modelName);
  const retained = await Deal.findById(deal._id);
  assert.equal(String(retained.ownerId), '000000000000000000000000'); assert.equal(String(retained.buyerId), String(buyer._id)); assert.deepEqual(retained.history, []);
  assert.equal((await call('/status', first.data)).data.status, 'completed');
  // Buyer-only deletion must cancel offers while preserving another owner's listing.
  const departingBuyer = await User.create({ name: 'Departing buyer', role: 'user', email: 'buyer-delete@example.test', passwordHash: hash });
  const buyerOffer = await Deal.create({ propertyId: other._id, buyerId: departingBuyer._id, ownerId: buyer._id, status: 'offered', offerAmount: 10, commissionAmount: 1, history: [{ terms: 'private buyer text' }], requestKey: 'unique-deletion-key' });
  const buyerRequest = await requestAccountDeletion(departingBuyer);
  await AccountDeletion.updateOne({ _id: buyerRequest.reference }, { $set: { nextAttemptAt: new Date(0) } });
  await processAccountDeletion();
  const cancelled = await Deal.findById(buyerOffer._id);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(String(cancelled.buyerId), '000000000000000000000000'); assert.equal(cancelled.requestKey, undefined);
  assert.equal(String(cancelled.ownerId), String(buyer._id)); assert.ok(await Property.exists({ _id: other._id }));
  for (let i = 0; i < 5; i++) await call('', {}, '198.51.100.80');
  assert.equal((await call('', {}, '198.51.100.80')).status, 429);
  console.log('PASS: password/confirmation/role gates, concurrent idempotency, session revocation, private status, accepted-deal deferral, partial-failure retry, lease concurrency, file/chunk cleanup, shared-file preservation, related-data removal and rate limiting');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await stopRegionCounts();
  if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  for (const file of localFiles) await fs.unlink(file).catch(() => {});
});
