import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File as LocalFile } from "expo-file-system";
import type { DocumentPickerAsset } from "expo-document-picker";

export async function prepareUpload(asset: DocumentPickerAsset, document: boolean) {
  const original = { file: { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" } as any, name: asset.name, cleanup: undefined as undefined | (() => void) };
  if (!/^image\/(jpeg|png|webp)$/.test(asset.mimeType || "")) return original;
  try {
    // Preserve document resolution and use gentle compression for small print.
    const { Image } = await import("react-native");
    const size = await Image.getSize(asset.uri);
    const edge = 1920;
    const actions = !document && Math.max(size.width, size.height) > edge
      ? [{ resize: size.width >= size.height ? { width: edge } : { height: edge } }] : [];
    const output = await manipulateAsync(asset.uri, actions, { format: SaveFormat.JPEG, compress: document ? 0.92 : 0.82 });
    const compressed = new LocalFile(output.uri);
    if (compressed.size >= (asset.size || new LocalFile(asset.uri).size)) { compressed.delete(); return original; }
    const name = asset.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: { uri: output.uri, name, type: "image/jpeg" } as any, name, cleanup: () => compressed.delete() };
  } catch { return original; }
}
