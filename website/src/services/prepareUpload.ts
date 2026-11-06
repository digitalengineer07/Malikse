import type { DocumentPickerAsset } from "expo-document-picker";

export async function prepareUpload(asset: DocumentPickerAsset, document: boolean) {
  const file = asset.file || new File([await (await fetch(asset.uri)).blob()], asset.name, { type: asset.mimeType });
  const original = { file, name: asset.name, cleanup: undefined as undefined | (() => void) };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return original;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = document ? 1 : Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", document ? 0.92 : 0.82));
    canvas.width = canvas.height = 0;
    if (!blob || blob.size >= file.size) return original;
    const name = asset.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), name, cleanup: undefined };
  } catch { return original; }
  finally { URL.revokeObjectURL(url); }
}
