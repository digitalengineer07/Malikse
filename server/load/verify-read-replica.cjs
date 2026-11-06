// Read-only deployment check. Never prints the connection URI or document data.
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI) throw Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 2,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  const hello = await db.command({ hello: 1 }, { readPreference: 'secondary' });
  if (hello.secondary !== true || hello.isWritablePrimary === true) throw Error('Secondary was not selected');
  await Promise.all([
    db.collection('properties').findOne({}, { projection: { _id: 1 }, readPreference: 'secondary' }),
    db.collection('inquiries').findOne({}, { projection: { _id: 1 }, readPreference: 'secondary' }),
  ]);
  console.log('MongoDB secondary selected; property and chat reads succeeded.');
}

main().catch(error => {
  console.error('Replica verification failed:', error.name);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
