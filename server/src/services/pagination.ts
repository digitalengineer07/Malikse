import type { Request, Response, RequestHandler } from "express";
import { Types } from "mongoose";

export const listFields = "title type location status price totalArea sellableArea negotiable badges media createdAt updatedAt ownerId assignedAdvisorId assignedVerifierId rejectionReason";
export function cursorFor(row: any) { return Buffer.from(JSON.stringify([new Date(row.createdAt).toISOString(), String(row._id)])).toString("base64url"); }
export function pageInput(input: any) {
  if (input.limit !== undefined && typeof input.limit !== "string" && typeof input.limit !== "number") throw new Error("Invalid limit");
  const limit = input.limit === undefined ? 50 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100");
  let filter = {};
  if (input.cursor !== undefined) {
    if (typeof input.cursor !== "string" || input.cursor.length > 200) throw new Error("Invalid cursor");
    let value: any;
    try { value = JSON.parse(Buffer.from(input.cursor, "base64url").toString()); } catch { throw new Error("Invalid cursor"); }
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" || !Number.isFinite(Date.parse(value[0])) || typeof value[1] !== "string" || !/^[a-f0-9]{24}$/i.test(value[1])) throw new Error("Invalid cursor");
    const date = new Date(value[0]);
    filter = { $or: [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: new Types.ObjectId(value[1]) } }] };
  }
  return { limit, filter };
}
export const validatePagination: RequestHandler = (req, res, next) => {
  if (req.method === "GET") {
    try {
      pageInput(req.query);
      for (const key of Object.keys(req.query)) if (key.endsWith("Cursor")) pageInput({ ...req.query, cursor: req.query[key] });
    } catch (error: any) { res.status(400).json({ message: error.message }); return; }
  }
  next();
};
export async function readPage(query: any, req: Request, res: Response): Promise<any[]> {
  const { limit, filter } = pageInput(req.query);
  const rows = await query.and([filter]).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).maxTimeMS(5000).lean();
  res.setHeader("X-Next-Cursor", rows.length > limit ? cursorFor(rows[limit - 1]) : "");
  return rows.slice(0, limit);
}
export async function readNamedPage(query: any, req: Request, name: string) {
  const { limit, filter } = pageInput({ ...req.query, cursor: req.query[`${name}Cursor`] });
  const rows = await query.and([filter]).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).maxTimeMS(5000).lean();
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? cursorFor(rows[limit - 1]) : undefined };
}
