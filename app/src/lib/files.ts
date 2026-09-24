export function extOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  const fromMime = file.type.split("/").pop();
  return (fromMime ?? "bin").toLowerCase();
}

export async function fileToBase64(
  file: File
): Promise<{ ext: string; base64: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return { ext: extOf(file), base64: btoa(binary) };
}
