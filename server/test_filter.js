const mongoose = require('mongoose');
const { User } = require('./src/models/User.model');
const { Property } = require('./src/models/Property.model');

mongoose.connect('mongodb://localhost:27017/malikse').then(async () => {
  const suspendedUsers = await User.find({ isSuspended: true }).select('_id');
  const suspendedUserIds = suspendedUsers.map(u => u._id);
  
  console.log("Suspended User IDs:", suspendedUserIds);
  
  const query = { status: "verified" };
  if (suspendedUserIds.length > 0) {
    query.ownerId = { $nin: suspendedUserIds };
  }
  
  const properties = await Property.find(query).select('_id ownerId title');
  console.log("Allowed Properties:", properties);
  
  const allProperties = await Property.find({ status: "verified" }).select('_id ownerId title');
  console.log("All Properties:", allProperties);
  
  process.exit(0);
});
