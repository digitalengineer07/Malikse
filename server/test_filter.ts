import mongoose from 'mongoose';
import { Property } from './src/models/Property.model';
import { User } from './src/models/User.model';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/malikse');
  const suspendedUsers = await User.find({ isSuspended: true }).select('_id');
  const suspendedUserIds = suspendedUsers.map(u => u._id);
  
  console.log("Suspended User IDs:", suspendedUserIds);
  
  const query: any = {};
  if (suspendedUserIds.length > 0) {
    query.ownerId = { $nin: suspendedUserIds };
  }
  
  const properties = await Property.find(query).select('_id ownerId title');
  console.log("Filtered Properties count:", properties.length);
  
  const allProperties = await Property.find().select('_id ownerId title');
  console.log("All Properties count:", allProperties.length);
  
  process.exit(0);
}

run();
