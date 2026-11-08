import fs from "fs/promises";
export async function scanDocument(filename: string) { return scanDocumentBytes(new Uint8Array(await fs.readFile(filename))); }
export async function scanDocumentBytes(bytes: Uint8Array) {
  const configured = process.env.DOCUMENT_SCAN_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Document scanning unavailable. Retry or contact support."), { status: 503 });
    return;
  }
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Document scanner must use a configured HTTPS endpoint");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/octet-stream", ...(process.env.DOCUMENT_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.DOCUMENT_SCAN_TOKEN}` } : {}) }, body: Buffer.from(bytes), signal: AbortSignal.timeout(30000), redirect: "error" }).catch(() => { throw Object.assign(new Error("Document scanner unavailable. Retry shortly."), { status: 503 }); });
  if (!response.ok) throw Object.assign(new Error("Document scan unavailable. Retry or contact support."), { status: 503 });
  if ((await response.json() as { clean?: boolean }).clean !== true) throw new Error("Document scan did not approve this file. Contact support.");
}

