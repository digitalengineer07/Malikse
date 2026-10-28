import mongoose, { Schema, Document } from "mongoose";
import { publicCacheHooks } from "../services/publicCacheHooks";
import { regionCountHooks } from "../services/regionCountHooks";

export interface IUser extends Document {
  role: "user" | "advisor" | "verifier" | "admin";
  name: string;
  mobile?: string;
  email?: string;
  passwordHash?: string;
  mobileVerifiedAt?: Date;
  emailVerifiedAt?: Date;
  kycDocuments: string[];
  isVerifiedIdentity: boolean;
  demoKycComplete: boolean;
  refreshTokenHash?: string;
  wishlist: mongoose.Types.ObjectId[];
  isSuspended: boolean;
  isActive: boolean;
  createdAt: Date;
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
    mobileVerifiedAt: { type: Date },
    emailVerifiedAt: { type: Date },
    kycDocuments: { type: [String], default: [] },
    isVerifiedIdentity: { type: Boolean, default: false },
    demoKycComplete: { type: Boolean, default: false },
    refreshTokenHash: { type: String },
    wishlist: { type: [Schema.Types.ObjectId], ref: "Property", default: [] },
    isSuspended: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
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
