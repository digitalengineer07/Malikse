import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function update() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/malikse');
  const db = mongoose.connection.db;
  if (!db) {
      console.log('No db');
      process.exit(1);
  }
  const properties = await db.collection('properties').find({}).toArray();
  let i = 0;
  const types = ['land', 'house', 'flat', 'shop', 'office'];
  for (const p of properties) {
    await db.collection('properties').updateOne({_id: p._id}, {$set: {type: types[i % types.length]}});
    i++;
  }
  console.log('Updated ' + properties.length + ' properties');
  process.exit(0);
}
update();
