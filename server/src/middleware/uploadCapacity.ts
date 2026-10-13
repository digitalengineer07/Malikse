import type { RequestHandler } from "express";
let active = 0;
// Bound simultaneous multipart buffers/disk writes on the single API process.
export const uploadCapacity: RequestHandler = (_req, res, next) => {
  if (active >= 4) { res.setHeader("Retry-After", "2"); res.status(503).json({ message: "Uploads are busy. Please retry shortly." }); return; }
  active++; let released = false;
  const release = () => { if (!released) { released = true; active--; } };
  res.once("finish", release); res.once("close", release); next();
};
