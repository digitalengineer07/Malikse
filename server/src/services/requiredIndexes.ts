import { isDeepStrictEqual } from "util";
import { FileCleanup } from "../models/FileCleanup.model";
import { ContactChange } from "../models/ContactChange.model";
import mongoose from "mongoose";
import { AccountDeletion } from "../models/AccountDeletion.model";
import { AssignmentCursor } from "../models/AssignmentCursor.model";
import { Deal } from "../models/Deal.model";
import { PropertyDocument } from "../models/Document.model";
import { DocumentDownload } from "../models/DocumentDownload.model";
import { Engagement } from "../models/Engagement.model";
import { Inquiry } from "../models/Inquiry.model";
import { Notification } from "../models/Notification.model";
import { PasswordReset } from "../models/PasswordReset.model";
import { Property } from "../models/Property.model";
import { PushDevice } from "../models/PushDevice.model";
import { PushReceipt } from "../models/PushReceipt.model";
import { RegionCount } from "../models/RegionCount.model";
import { RegionCountState } from "../models/RegionCount.model";
import { Registration } from "../models/Registration.model";
import { SearchCache } from "../models/SearchCache.model";
import { SearchPreference } from "../models/SearchPreference.model";
import { User } from "../models/User.model";
export const indexedModels: mongoose.Model<any>[] = [FileCleanup,ContactChange,AccountDeletion,AssignmentCursor,Deal,PropertyDocument,DocumentDownload,Engagement,Inquiry,Notification,PasswordReset,Property,PushDevice,PushReceipt,RegionCount,RegionCountState,Registration,SearchCache,SearchPreference,User];
// Earlier releases used seller index names for staff keys. Accept those aliases
// only when the complete key and constraint definitions match.
function matchesIndex(model: mongoose.Model<any>, index: any, keys: any, options: any) {
  const legacyName = model.modelName === "Inquiry" && (
    (options.name === "inquiry_staff_newest" && index.name === "inquiry_seller_newest") ||
    (options.name === "inquiry_staff_cursor" && index.name === "inquiry_seller_cursor")
  );
  const aliasName = legacyName || (
    model.modelName === "User" && (
      (options.name === "user_advisor_code" && index.name === "advisorCode_1") ||
      (options.name === "advisorCode_1" && index.name === "user_advisor_code")
    )
  );
  return (Object.values(keys).includes("text")
    ? Object.keys(index.weights || {}).sort().join(",") === Object.keys(keys).filter(key => keys[key] === "text").sort().join(",")
    : isDeepStrictEqual(index.key, keys)) && (!options.name || index.name === options.name || aliasName)
    && isDeepStrictEqual(index.partialFilterExpression, options.partialFilterExpression)
    && Boolean(index.unique) === Boolean(options.unique) && Boolean(index.sparse) === Boolean(options.sparse)
    && index.expireAfterSeconds === options.expireAfterSeconds;
}
export async function ensureActivityIndexes() {
  const existing = await Inquiry.collection.indexes();
  for (const [keys, options] of Inquiry.schema.indexes()) {
    if (!("updatedAt" in keys)) continue;
    if (!existing.some(index => matchesIndex(Inquiry, index, keys, options))) {
      await Inquiry.collection.createIndex(keys as mongoose.mongo.IndexSpecification);
    }
  }
}
export async function createRequiredIndexes() {
  // Additive only: retain legacy seller indexes and reuse equivalent staff aliases.
  for (const model of indexedModels) {
    await model.createCollection();
    const actual = await model.collection.indexes();
    for (const [keys, options] of model.schema.indexes()) {
      if (!actual.some(index => matchesIndex(model, index, keys, options))) {
        await model.collection.createIndex(keys as mongoose.mongo.IndexSpecification, options as mongoose.mongo.CreateIndexesOptions);
      }
    }
  }
}
export async function verifyRequiredIndexes() {
  const concurrency = process.env.NODE_ENV === "production" ? 4 : 1;
  for (let offset = 0; offset < indexedModels.length; offset += concurrency) {
    await Promise.all(indexedModels.slice(offset, offset + concurrency).map(async model => {
      const actual = await mongoose.connection.collection(model.collection.name).indexes();
      for (const [keys, options] of model.schema.indexes()) {
        if (!actual.some(index => matchesIndex(model, index, keys, options))) {
          throw new Error(`Required index missing on ${model.modelName}; run npm run db:indexes:prod before traffic`);
        }
      }
    }));
  }
}
