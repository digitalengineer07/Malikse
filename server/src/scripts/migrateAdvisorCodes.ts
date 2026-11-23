import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User.model";
import { generateUniqueAdvisorCode } from "../services/advisorCodeService";

export async function migrateAdvisorCodes(): Promise<{ updated: number; skipped: number }> {
  const advisors = await User.find({ role: "advisor" }).sort({ createdAt: 1 });
  let updated = 0;
  let skipped = 0;

  for (const advisor of advisors) {
    if (advisor.advisorCode) {
      skipped++;
      continue;
    }
    const code = await generateUniqueAdvisorCode();
    advisor.advisorCode = code;
    await advisor.save();
    console.log(`[migrateAdvisorCodes] Assigned ${code} to advisor ${advisor.name} (${advisor._id})`);
    updated++;
  }

  return { updated, skipped };
}

if (require.main === module) {
  (async () => {
    try {
      const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/malikse";
      await mongoose.connect(uri);
      const result = await migrateAdvisorCodes();
      console.log(`Migration complete: ${result.updated} updated, ${result.skipped} already had codes.`);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error("Migration failed:", err);
      process.exit(1);
    }
  })();
}
