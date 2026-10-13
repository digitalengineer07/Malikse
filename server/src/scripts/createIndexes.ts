import { Registration } from "../models/Registration.model";
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { Inquiry } from "../models/Inquiry.model";
import { Deal } from "../models/Deal.model";
import { PropertyDocument } from "../models/Document.model";
import { SearchCache } from "../models/SearchCache.model";

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", { autoIndex: false });
  try {
    // Additive only: never drop existing indexes automatically during a deployment.
    for (const model of [Registration, User, Property, Inquiry, Deal, PropertyDocument, SearchCache]) {
      await model.createIndexes();
      console.log(`Indexes ready: ${model.modelName}`);
    }
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error("Index migration failed"); process.exitCode = 1; });
