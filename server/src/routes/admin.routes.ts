import { readPage, readNamedPage, listFields } from "../services/pagination";
import bcrypt from "../services/passwords";
import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { Deal } from "../models/Deal.model";
import { Inquiry } from "../models/Inquiry.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { activeStaffFilter, historyEvent, transition } from "../services/propertyWorkflow";
import { performanceMetrics } from "../services/performanceMetrics";

const router = Router();
router.get("/performance", authGuard, roleGuard("admin"), (_req, res) => {
  res.json({ counters: { ...performanceMetrics }, memory: process.memoryUsage(), uptimeSeconds: process.uptime() });
});
for (const name of ["id", "userId", "staffId", "propertyId"]) {
  router.param(name, (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ message: "Invalid record ID" }));
}

router.post("/properties/:id/assign", authGuard, roleGuard("admin"), async (req: any, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    const role = property.status === "pending" ? "advisor" : property.status === "advisor_verified" ? "verifier" : null;
    if (!role) return res.status(409).json({ message: "Only pending review stages can be assigned" });
    const staff = await User.findOne({ _id: req.body.staffId, role, ...activeStaffFilter });
    if (!staff) return res.status(400).json({ message: `Choose an active ${role} account` });
    const field = role === "advisor" ? "assignedAdvisorId" : "assignedVerifierId";
    const updated = await transition(property, { [field]: staff._id }, historyEvent(req.user, property.status, property.status, "assigned", { staffId: staff._id, assignedRole: role }));
    if (!updated) return res.status(409).json({ message: "Property changed. Refresh and try again" });
    res.json(updated);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

// Staff accounts are created only by a signed-in Admin.
router.get("/staff", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const staff = await readPage(User.find({ role: { $in: ["advisor", "verifier"] }, passwordHash: { $exists: true, $ne: "" } })
      .select("name mobile email role isActive createdAt")
      .sort({ createdAt: -1 }), req, res);
    res.json(staff.map((person) => ({
      id: person._id.toString(), name: person.name, mobile: person.mobile,
      email: person.email, role: person.role, isActive: person.isActive, createdAt: person.createdAt,
    })));
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

router.post("/staff", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const { role, name, mobile, email, password } = req.body;
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanMobile = typeof mobile === "string" ? mobile.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (role !== "advisor" && role !== "verifier") {
      return res.status(400).json({ message: "Choose Advisor or Verifier" });
    }
    if (cleanName.length < 2 || cleanName.length > 200 || !/^[0-9]{10}$/.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter a name and 10-digit mobile number" });
    }
    if (cleanEmail.length > 254 || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Staff password must contain at least 8 characters and at most 72 UTF-8 bytes" });
    }
    if (await User.exists({ mobile: cleanMobile })) {
      return res.status(409).json({ message: "Mobile number already registered" });
    }
    const person = await User.create({
      role, name: cleanName, mobile: cleanMobile, email: cleanEmail || undefined,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({
      id: person._id.toString(), name: person.name, mobile: person.mobile,
      email: person.email, role: person.role, isActive: person.isActive, createdAt: person.createdAt,
    });
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ message: "Mobile number already registered" });
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

let summaryCache: { expires: number; value: any } | undefined;
let summaryWork: Promise<any> | undefined;
// GET /admin/dashboard/summary
router.get("/dashboard/summary", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    if (summaryCache && summaryCache.expires > Date.now()) return res.json(summaryCache.value);
    if (!summaryWork) summaryWork = (async () => {
    // Three bounded result sets instead of serial counts and loading every completed deal.
    const [userCounts, propertyCounts, dealCounts] = await Promise.all([
      User.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]).option({ maxTimeMS: 5000 }),
      Property.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).option({ maxTimeMS: 5000 }),
      Deal.aggregate<{ _id: string; count: number; commission: number }>([{ $group: { _id: "$status", count: { $sum: 1 }, commission: { $sum: "$commissionAmount" } } }]).option({ maxTimeMS: 5000 }),
    ]);
    const users = Object.fromEntries(userCounts.map(row => [row._id, row.count]));
    const properties = Object.fromEntries(propertyCounts.map(row => [row._id, row.count]));
    const activeDeals = dealCounts.filter(row => !["completed", "cancelled", "rejected"].includes(row._id)).reduce((sum, row) => sum + row.count, 0);
    const commissionEarned = (dealCounts.find(row => row._id === "completed")?.commission || 0) * 2;

    return {
      users: { total: users.user || 0, advisors: users.advisor || 0, verifiers: users.verifier || 0 },
      properties: { total: propertyCounts.reduce((sum, row) => sum + row.count, 0), draft: properties.draft || 0, pending: properties.pending || 0, advisorPending: properties.pending || 0, verifierPending: properties.advisor_verified || 0, corrections: properties.correction_required || 0, verified: properties.verified || 0, rejected: properties.rejected || 0 },
      deals: { active: activeDeals },
      financials: { commissionEarned }
    };
    })().then(value => { summaryCache = { value, expires: Date.now() + 5000 }; return value; }).finally(() => { summaryWork = undefined; });
    res.json(await summaryWork);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// GET /admin/properties (for queues)
router.get("/properties", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const { status } = req.query;
    if (status !== undefined && (typeof status !== "string" || !["draft", "queued", "pending", "advisor_verified", "correction_required", "rejected", "verified", "sold"].includes(status))) return res.status(400).json({ message: "Invalid property status" });
    const query: any = status ? { status } : {};

    // Exclude suspended users
    const suspendedUsers = await User.find({ isSuspended: true }).select('_id');
    const suspendedUserIds = suspendedUsers.map(u => u._id);
    if (suspendedUserIds.length > 0) {
      query.ownerId = { $nin: suspendedUserIds };
    }

    const properties = await readPage(Property.find(query).select(listFields).populate("ownerId", "name mobile"), req, res);
    res.json(properties);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// GET /admin/users
router.get("/users", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const users = await readPage(User.find({ role: "user" })
      .select("name mobile email role createdAt isVerifiedIdentity demoKycComplete isSuspended")
      .sort({ createdAt: -1 }), req, res);
    res.json(users);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// GET /admin/users/:userId/properties
router.get("/users/:userId/properties", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const properties = await readPage(Property.find({ ownerId: req.params.userId }).select(listFields), req, res);
    res.json(properties);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Toggle user suspension
router.put("/users/:userId/suspend", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== "user") return res.status(404).json({ message: "User not found" });
    if (req.body?.isSuspended !== undefined && typeof req.body.isSuspended !== "boolean") return res.status(400).json({ message: "isSuspended must be a boolean" });
    // Legacy callers may omit the field; current clients send the desired state.
    user.isSuspended = req.body?.isSuspended ?? !user.isSuspended;
    await user.save();
    res.json({ id: user._id, isSuspended: user.isSuspended });
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Toggle staff active status
router.put("/staff/:staffId/status", authGuard, roleGuard("admin"), async (req: any, res) => {
  try {
    const staff = await User.findById(req.params.staffId);
    if (!staff || !["advisor", "verifier"].includes(staff.role)) return res.status(404).json({ message: "Staff not found" });
    if (req.body?.isActive !== undefined && typeof req.body.isActive !== "boolean") return res.status(400).json({ message: "isActive must be a boolean" });
    staff.isActive = req.body?.isActive ?? !staff.isActive;
    await staff.save();
    // Retry assignment cleanup even if a previous request saved the state but
    // failed before releasing assignments. The assignment filter makes it safe.
    if (!staff.isActive) {
      const field = staff.role === "advisor" ? "assignedAdvisorId" : "assignedVerifierId";
      const status = staff.role === "advisor" ? "pending" : "advisor_verified";
      await Property.updateMany({ [field]: staff._id, status }, {
        $unset: { [field]: 1 }, $inc: { __v: 1 },
        $push: { verificationHistory: historyEvent(req.user, status, status, "reviewer_deactivated", { staffId: staff._id }) },
      });
    }
    res.json({ id: staff._id, name: staff.name, role: staff.role, isActive: staff.isActive });
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Get user transactions
router.get("/users/:userId/transactions", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const [inquiries, deals] = await Promise.all([
      readNamedPage(Inquiry.find({ $or: [{ buyerId: req.params.userId }, { sellerId: req.params.userId }] }).select("propertyId status offerAmount createdAt").populate("propertyId", "title price type location"), req, "inquiries"),
      readNamedPage(Deal.find({ $or: [{ buyerId: req.params.userId }, { ownerId: req.params.userId }] }).populate("propertyId", "title price type location"), req, "deals"),
    ]);
    res.json({ inquiries: inquiries.items, deals: deals.items, nextInquiries: inquiries.nextCursor, nextDeals: deals.nextCursor });
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Get staff workload
router.get("/staff/:staffId/workload", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const staffId = req.params.staffId;
    const [assigned, history] = await Promise.all([
      readNamedPage(Property.find({ $or: [{ assignedAdvisorId: staffId }, { assignedVerifierId: staffId }] }).select("title status createdAt location"), req, "assigned"),
      readNamedPage(Property.find({ verificationHistory: { $elemMatch: { actorId: staffId, action: { $in: ["approve", "correction", "reject"] } } } }).select("title status createdAt location"), req, "history"),
    ]);
    res.json({ assigned: assigned.items, history: history.items, nextAssigned: assigned.nextCursor, nextHistory: history.nextCursor });
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Get property audit
router.get("/properties/:propertyId/audit", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const prop = await Property.findById(req.params.propertyId).select("verificationHistory documents");
    if (!prop) return res.status(404).json({ message: "Property not found" });
    res.json(prop);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

export default router;
