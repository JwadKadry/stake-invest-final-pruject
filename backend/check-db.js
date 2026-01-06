// Quick DB check script
// Run: node check-db.js (from backend directory)

require('dotenv').config();
const mongoose = require('mongoose');
const Investment = require('./src/models/Investment');

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // 1. Count all documents
    const totalCount = await Investment.countDocuments();
    console.log(`Total investments in DB: ${totalCount}\n`);

    // 2. Group by userId to see distribution
    console.log('Investments grouped by userId:');
    const byUser = await Investment.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          statuses: { $push: "$status" }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    for (const user of byUser) {
      console.log(`  userId: ${user._id}`);
      console.log(`    Count: ${user.count}`);
      console.log(`    Total Amount: ${user.totalAmount}`);
      console.log(`    Statuses: ${[...new Set(user.statuses)].join(', ')}`);
      console.log('');
    }

    // 3. Check for investments without userId
    const noUserId = await Investment.countDocuments({ userId: { $exists: false } });
    if (noUserId > 0) {
      console.log(`⚠️  WARNING: ${noUserId} investments without userId!\n`);
    }

    // 4. Check for CANCELED vs ACTIVE
    const activeCount = await Investment.countDocuments({ status: { $ne: "CANCELED" } });
    const canceledCount = await Investment.countDocuments({ status: "CANCELED" });
    console.log(`Active investments: ${activeCount}`);
    console.log(`Canceled investments: ${canceledCount}\n`);

    // 5. Sample a few documents to see structure
    console.log('Sample investment documents:');
    const samples = await Investment.find().limit(3).lean();
    for (const sample of samples) {
      console.log(`  ID: ${sample._id}`);
      console.log(`  userId: ${sample.userId}`);
      console.log(`  propertyId: ${sample.propertyId}`);
      console.log(`  amount: ${sample.amount}`);
      console.log(`  status: ${sample.status}`);
      console.log(`  propertyTitle: ${sample.propertyTitle || '(missing)'}`);
      console.log(`  propertyCity: ${sample.propertyCity || '(missing)'}`);
      console.log('');
    }

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDB();

