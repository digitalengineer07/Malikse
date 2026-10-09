import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  role: "user" | "advisor" | "verifier" | "admin";
  name: string;
  mobile: string;
  email?: string;
  passwordHash?: string;
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
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String },
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

export const User = mongoose.model<IUser>("User", UserSchema);
