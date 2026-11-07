import mongoose, { Schema, Document } from "mongoose";
import { publicCacheHooks } from "../services/publicCacheHooks";
import { regionCountHooks } from "../services/regionCountHooks";

export interface IUser extends Document {
  role: "user" | "advisor" | "verifier" | "admin";
  name: string;
  mobile?: string;
  email?: string;
  passwordHash?: string;
  sessionVersion: number;
  administrativeHistory: { actorId: string; action: string; reason: string; at: Date; value?: boolean }[];
  mobileVerifiedAt?: Date;
  emailVerifiedAt?: Date;
  kycDocuments: string[];
  kycStatus?: "not_submitted" | "pending" | "approved" | "correction_required" | "rejected";
  kycSubmittedAt?: Date;
  isVerifiedIdentity: boolean;
  identityReview?: { reviewerId: mongoose.Types.ObjectId; reviewedAt: Date; notes: string };
  demoKycComplete: boolean;
  refreshTokenHash?: string;
  refreshTokenExpiresAt?: Date;
  wishlist: mongoose.Types.ObjectId[];
  isSuspended: boolean;
  isActive: boolean;
  createdAt: Date;
  deletionRequestedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    role: {
      type: String,
      enum: ["user", "advisor", "verifier", "admin"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: false, unique: true, sparse: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String },
    sessionVersion: { type: Number, default: 0 },
    administrativeHistory: [{ actorId: String, action: String, reason: String, at: Date, value: Boolean }],
    mobileVerifiedAt: { type: Date },
    emailVerifiedAt: { type: Date },
    kycStatus: { type: String, enum: ["not_submitted", "pending", "approved", "correction_required", "rejected"], default: "not_submitted" },
    kycSubmittedAt: Date,
    kycDocuments: { type: [String], default: [] },
    isVerifiedIdentity: { type: Boolean, default: false },
    identityReview: { reviewerId: { type: Schema.Types.ObjectId, ref: "User" }, reviewedAt: Date, notes: String },
    demoKycComplete: { type: Boolean, default: false },
    refreshTokenHash: { type: String },
    // Do not use a TTL index here: MongoDB TTL deletes the entire User document.
    refreshTokenExpiresAt: { type: Date },
    wishlist: { type: [Schema.Types.ObjectId], ref: "Property", default: [] },
    isSuspended: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deletionRequestedAt: Date,
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, createdAt: -1 }, { name: "user_role_newest" });
UserSchema.index({ isSuspended: 1 }, { name: "user_suspension" });
UserSchema.index({ isActive: 1 }, { name: "user_active" });
UserSchema.index({ role: 1, createdAt: -1, _id: -1 }, { name: "user_role_cursor" });

UserSchema.pre("save", function (this: any, next: (err?: any) => void) {
  if (this.mobile === "" || this.mobile === null) {
    this.mobile = undefined;
  }
  if (this.email === "" || this.email === null) {
    this.email = undefined;
  }
  next();
});

UserSchema.plugin(publicCacheHooks, { account: true });
UserSchema.plugin(regionCountHooks, { account: true });
export const User = mongoose.model<IUser>("User", UserSchema);
