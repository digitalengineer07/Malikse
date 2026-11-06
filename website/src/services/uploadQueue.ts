import { randomUUID } from "expo-crypto";
import type { DocumentPickerAsset } from "expo-document-picker";
import { prepareUpload } from "./prepareUpload";
import { propertyService } from "./propertyService";
import { documentService } from "./documentService";

export type UploadOptions = { uploadId: string; onProgress: (percent: number) => void };
const ids = new WeakMap<object, string>();
const idFor = (item: object) => { let id = ids.get(item); if (!id) { id = randomUUID(); ids.set(item, id); } return id; };

// Wait for every active task before reporting failure, so a retry cannot overlap it.
export async function runUploadTasks(tasks: Array<() => Promise<void>>) {
  let next = 0;
  let failure: unknown;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(2, tasks.length) }, async () => {
    while (!failed && next < tasks.length) {
      const task = tasks[next++];
      try { await task(); } catch (error) { failed = true; failure = error; }
    }
  }));
  if (failed) throw failure;
}

export async function uploadListingFiles(propertyId: string, photos: DocumentPickerAsset[], documents: { asset: DocumentPickerAsset; type: string }[], callbacks: {
  progress: (message: string) => void;
  photo: (asset: DocumentPickerAsset, url: string) => void;
  document: (item: { asset: DocumentPickerAsset; type: string }) => void;
}) {
  const states = [...photos.map(a => `${a.name}: Waiting`), ...documents.map(d => `${d.asset.name}: Waiting`)];
  const update = (index: number, name: string, status: string) => { states[index] = `${name}: ${status}`; callbacks.progress(states.join("\n")); };
  const task = (asset: DocumentPickerAsset, index: number, doc?: typeof documents[number]) => async () => {
    update(index, asset.name, "Preparing…");
    const prepared = await prepareUpload(asset, !!doc);
    const options = { uploadId: idFor(doc || asset), onProgress: (percent: number) => update(index, asset.name, percent >= 100 ? "Saving…" : `Uploading ${percent}%`) };
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          if (doc) { await documentService.uploadDocument(propertyId, doc.type, prepared.file, prepared.name, options); callbacks.document(doc); }
          else { const result = await propertyService.uploadPhoto(propertyId, prepared.file, prepared.name, options); callbacks.photo(asset, result.url); }
          update(index, asset.name, "Uploaded");
          break;
        } catch (error: any) {
          const status = error.response?.status;
          if (attempt >= 2 || (status && ![408, 429, 502, 503, 504].includes(status))) { update(index, asset.name, "Failed — retry submission"); throw error; }
          update(index, asset.name, "Retrying…");
          const retryAfter = Number(error.response?.headers?.["retry-after"]);
          await new Promise(resolve => setTimeout(resolve, Math.min(30000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0))));
        }
      }
    } finally { try { prepared.cleanup?.(); } catch { /* Cache cleanup must not fail an upload. */ } }
  };
  // Finish the cover first so concurrency cannot reorder the selected cover photo.
  if (photos.length) await task(photos[0], 0)();
  await runUploadTasks([
    ...photos.slice(1).map((asset, i) => task(asset, i + 1)),
    ...documents.map((doc, i) => task(doc.asset, photos.length + i, doc)),
  ]);
}
