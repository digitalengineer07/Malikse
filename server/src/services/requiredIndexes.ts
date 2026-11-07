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
export async function createRequiredIndexes() {
  // Additive only; conflicting legacy constraints require an offline migration.
  for (const model of indexedModels) await model.createIndexes();
}
export async function verifyRequiredIndexes() {
  for (const model of indexedModels) {
    const actual = await mongoose.connection.collection(model.collection.name).indexes();
    for (const [keys, options] of model.schema.indexes()) {
      const match = actual.find(index => (Object.values(keys).includes("text")
        ? Object.keys(index.weights || {}).sort().join(",") === Object.keys(keys).filter(key => keys[key] === "text").sort().join(",")
        : isDeepStrictEqual(index.key, keys)) && (!options.name || index.name === options.name) && isDeepStrictEqual(index.partialFilterExpression, options.partialFilterExpression) && Boolean(index.unique) === Boolean(options.unique) && Boolean(index.sparse) === Boolean(options.sparse) && index.expireAfterSeconds === options.expireAfterSeconds);
      if (!match) throw new Error(`Required index missing on ${model.modelName}; run npm run db:indexes:prod before traffic`);
    }
  }
}
