import bcrypt from "bcryptjs";
import { Router } from "express";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { Deal } from "../models/Deal.model";
import { Inquiry } from "../models/Inquiry.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { activeStaffFilter, historyEvent, transition } from "../services/propertyWorkflow";

const router = Router();

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
router.get("/staff", authGuard, roleGuard("admin"), async (_req, res) => {
  try {
    const staff = await User.find({ role: { $in: ["advisor", "verifier"] }, passwordHash: { $exists: true, $ne: "" } })
      .select("name mobile email role isActive createdAt")
      .sort({ createdAt: -1 });
    res.json(staff.map((person) => ({
      id: person._id.toString(), name: person.name, mobile: person.mobile,
      email: person.email, role: person.role, isActive: person.isActive, createdAt: person.createdAt,
    })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
    if (cleanName.length < 2 || !/^[0-9]{10}$/.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter a name and 10-digit mobile number" });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Staff password must be at least 8 characters" });
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
    res.status(500).json({ message: error.message });
  }
});

// GET /admin/dashboard/summary
router.get("/dashboard/summary", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalAdvisors = await User.countDocuments({ role: "advisor" });
    const totalVerifiers = await User.countDocuments({ role: "verifier" });
    const totalProperties = await Property.countDocuments();

    const pendingProperties = await Property.countDocuments({ status: "pending" });
    const draftProperties = await Property.countDocuments({ status: "draft" });
    const verifierPending = await Property.countDocuments({ status: "advisor_verified" });
    const corrections = await Property.countDocuments({ status: "correction_required" });
    const verifiedProperties = await Property.countDocuments({ status: "verified" });
    const rejectedProperties = await Property.countDocuments({ status: "rejected" });

    const activeDeals = await Deal.countDocuments({ status: { $nin: ["completed", "cancelled", "rejected"] } });

    // Sum total commissions for completed deals
    const completedDeals = await Deal.find({ status: "completed" });
    const commissionEarned = completedDeals.reduce((sum, deal) => sum + (deal.commissionAmount * 2), 0); // Both sides

    res.json({
      users: { total: totalUsers, advisors: totalAdvisors, verifiers: totalVerifiers },
      properties: { total: totalProperties, draft: draftProperties, pending: pendingProperties, advisorPending: pendingProperties, verifierPending, corrections, verified: verifiedProperties, rejected: rejectedProperties },
      deals: { active: activeDeals },
      financials: { commissionEarned }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /admin/properties (for queues)
router.get("/properties", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const { status } = req.query;
    const query: any = status ? { status } : {};

    // Exclude suspended users
    const suspendedUsers = await User.find({ isSuspended: true }).select('_id');
    const suspendedUserIds = suspendedUsers.map(u => u._id);
    if (suspendedUserIds.length > 0) {
      query.ownerId = { $nin: suspendedUserIds };
    }

    const properties = await Property.find(query).populate("ownerId", "name mobile").sort("-createdAt");
    res.json(properties);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /admin/users
router.get("/users", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("name mobile email role createdAt isVerifiedIdentity demoKycComplete isSuspended")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /admin/users/:userId/properties
router.get("/users/:userId/properties", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const properties = await Property.find({ ownerId: req.params.userId }).sort("-createdAt");
    res.json(properties);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle user suspension
router.put("/users/:userId/suspend", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== "user") return res.status(404).json({ message: "User not found" });
    console.log("before " + user.isSuspended);

    user.isSuspended = !user.isSuspended;

    console.log("before save" + user.isSuspended);
    await user.save();
    console.log("after save" + user.isSuspended);
    res.json({ id: user._id, isSuspended: user.isSuspended });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle staff active status
router.put("/staff/:staffId/status", authGuard, roleGuard("admin"), async (req: any, res) => {
  try {
    const staff = await User.findById(req.params.staffId);
    if (!staff || !["advisor", "verifier"].includes(staff.role)) return res.status(404).json({ message: "Staff not found" });
    staff.isActive = !staff.isActive;
    await staff.save();
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
    res.status(500).json({ message: error.message });
  }
});

// Get user transactions
router.get("/users/:userId/transactions", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ $or: [{ buyerId: req.params.userId }, { sellerId: req.params.userId }] }).populate("propertyId", "title price type location");
    const deals = await Deal.find({ $or: [{ buyerId: req.params.userId }, { ownerId: req.params.userId }] }).populate("propertyId", "title price type location");
    res.json({ inquiries, deals });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get staff workload
router.get("/staff/:staffId/workload", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const staffId = req.params.staffId;
    const assignedProps = await Property.find({ $or: [{ assignedAdvisorId: staffId }, { assignedVerifierId: staffId }] }).select("title status createdAt location");
    const verifiedHistory = await Property.find({ verificationHistory: { $elemMatch: { actorId: staffId, action: { $in: ["approve", "correction", "reject"] } } } }).select("title status createdAt location");
    res.json({ assigned: assignedProps, history: verifiedHistory });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get property audit
router.get("/properties/:propertyId/audit", authGuard, roleGuard("admin"), async (req, res) => {
  try {
    const prop = await Property.findById(req.params.propertyId).select("verificationHistory documents");
    if (!prop) return res.status(404).json({ message: "Property not found" });
    res.json(prop);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
