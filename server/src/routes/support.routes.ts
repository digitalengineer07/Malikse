import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { isValidObjectId } from "mongoose";
import { authGuard, type AuthRequest } from "../middleware/auth.middleware";
import { SupportTicket, supportCategories, supportStatuses } from "../models/SupportTicket.model";
import { Property } from "../models/Property.model";
import { Inquiry } from "../models/Inquiry.model";
import { assignedStaff, OfferError } from "../services/marketplace";
import { canReadProperty } from "../services/propertyWorkflow";
import { readPage } from "../services/pagination";

const router = Router();
router.use(authGuard);
router.use(rateLimit({
  windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false,
  skip: req => req.method !== "POST",
  keyGenerator: req => (req as AuthRequest).user!.id,
}));
const isStaffChat = (req: AuthRequest) => req.query.channel === "verifier_chat";
router.use((request: AuthRequest, res, next) => {
  if (request.query.channel !== undefined && !isStaffChat(request)) return res.status(400).json({ message: "Invalid conversation channel." });
  if (isStaffChat(request) && !["admin", "verifier"].includes(request.user!.role)) {
    return res.status(403).json({ message: "This chat is available to verifiers and admins." });
  }
  next();
});
const scope = (req: AuthRequest) => ({
  channel: isStaffChat(req) ? "verifier_chat" : { $ne: "verifier_chat" },
  ...(req.user!.role === "admin" ? {} : { requester: req.user!.id }),
});
const listFields = "category subject status createdAt updatedAt";
const validRequestId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
const cleanText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
function ticketHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function canLink(actor: NonNullable<AuthRequest["user"]>, kind: "property" | "conversation", id: string) {
  if (kind === "property") {
    const property = await Property.findById(id).select("ownerId assignedAdvisorId assignedVerifierId status badges").lean();
    return !!property && (canReadProperty(property as Parameters<typeof canReadProperty>[0], actor) ||
      (property.status === "verified" && property.badges?.fullyVerified));
  }
  const thread = await Inquiry.findOne({ _id: id, staffId: { $exists: true } }).select("buyerId propertyId").lean();
  if (!thread) return false;
  if (String(thread.buyerId) === actor.id) return true;
  const property = await Property.findById(thread.propertyId).select("assignedAdvisorId assignedVerifierId").lean();
  if (!property) return false;
  try { return String((await assignedStaff(property))._id) === actor.id; }
  catch (error) { if (error instanceof OfferError) return false; throw error; }
}

router.get("/", ticketHandler(async (request, res) => {
  const req = request as AuthRequest;
  const status = req.query.status;
  if (status !== undefined && !supportStatuses.some(value => value === status)) return res.status(400).json({ message: "Invalid ticket status." });
  const includeRequester = isStaffChat(req) && req.user!.role === "admin";
  const query = SupportTicket.find({ ...scope(req), ...(status ? { status } : {}) })
    .select(includeRequester ? `${listFields} requester` : listFields);
  if (includeRequester) query.populate("requester", "name role");
  // The inbox is ordered by recent activity so customer replies return to the top.
  const rows = await readPage(query, req, res, "updatedAt");
  return res.json(rows);
}));

router.post("/", ticketHandler(async (request, res) => {
  const req = request as AuthRequest;
  const actor = req.user!;
  if (actor.role === "admin") return res.status(403).json({ message: "Use the support inbox to reply to requests." });
  const staffChat = isStaffChat(req);
  const { category: requestedCategory, subject: rawSubject, body: rawBody, requestId, referenceKind, referenceId } = req.body ?? {};
  const category = staffChat ? "assignment" : requestedCategory;
  if (staffChat && (referenceKind !== undefined || referenceId !== undefined)) {
    return res.status(400).json({ message: "Send property or conversation reports through Contact support." });
  }
  const subject = cleanText(rawSubject, 100), body = cleanText(rawBody, 2000);
  if (!subject || !body || !validRequestId(requestId) || !supportCategories.some(value => value === category)) {
    return res.status(400).json({ message: "Choose a category and enter a subject and message." });
  }
  const lookup = { ...scope(req), requestId };
  const existing = await SupportTicket.findOne(lookup).select(listFields).lean();
  if (existing) return res.json(existing);
  if (referenceKind !== undefined || referenceId !== undefined) {
    if ((referenceKind !== "property" && referenceKind !== "conversation") || typeof referenceId !== "string" ||
        !isValidObjectId(referenceId) || !(await canLink(actor, referenceKind, referenceId))) {
      return res.status(404).json({ message: "Linked property or conversation is unavailable." });
    }
  }
  try {
    const ticket = await SupportTicket.create({
      requester: actor.id, requestId, channel: staffChat ? "verifier_chat" : "support", category, subject, referenceKind, referenceId,
      messages: [{ author: actor.id, side: "requester", body, requestId }],
    });
    return res.status(201).json({ _id: ticket._id, status: ticket.status });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const duplicate = await SupportTicket.findOne(lookup).select(listFields).lean();
    if (!duplicate) throw error;
    return res.json(duplicate);
  }
}));

router.param("id", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(404).json({ message: "Ticket not found." }));

router.get("/:id", ticketHandler(async (request, res) => {
  const req = request as AuthRequest;
  const admin = req.user!.role === "admin";
  const query = SupportTicket.findOne({ _id: req.params.id, ...scope(req) })
    .select(`category subject status referenceKind referenceId createdAt updatedAt messages.side messages.body messages.sentAt messages.requestId${admin ? " requester" : ""}`);
  if (admin) query.populate("requester", "name role");
  const ticket = await query.lean();
  if (!ticket) return res.status(404).json({ message: "Ticket not found." });
  return res.json(ticket);
}));

router.post("/:id/replies", ticketHandler(async (request, res) => {
  const req = request as AuthRequest;
  const actor = req.user!;
  const body = cleanText(req.body?.body, 2000), requestId = req.body?.requestId;
  if (!body || !validRequestId(requestId)) return res.status(400).json({ message: "Enter a reply of up to 2,000 characters." });
  const match = { _id: req.params.id, ...scope(req) };
  const staff = actor.role === "admin";
  const updated = await SupportTicket.updateOne(
    { ...match, status: { $ne: "resolved" }, "messages.99": { $exists: false }, "messages.requestId": { $ne: requestId } },
    { $push: { messages: { author: actor.id, requestId, body, side: staff ? "support" : "requester", sentAt: new Date() } },
      $set: { status: staff ? "awaiting_reply" : "open" } },
  );
  if (updated.modifiedCount) return res.sendStatus(204);
  if (await SupportTicket.exists({ ...match, messages: { $elemMatch: { author: actor.id, requestId } } })) return res.sendStatus(204);
  if (!await SupportTicket.exists(match)) return res.status(404).json({ message: "Ticket not found." });
  return res.status(409).json({ message: "This ticket is resolved or has reached its reply limit. You can open a new request." });
}));

router.post("/:id/resolve", ticketHandler(async (request, res) => {
  const req = request as AuthRequest;
  const result = await SupportTicket.updateOne({ _id: req.params.id, ...scope(req) }, { $set: { status: "resolved" } });
  if (!result.matchedCount) return res.status(404).json({ message: "Ticket not found." });
  return res.sendStatus(204);
}));

export default router;
