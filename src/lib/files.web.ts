// Web: görsel seçici dosyayı data: adresi olarak verir
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('data:')) {
    const bin = atob(uri.slice(uri.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  return (await fetch(uri)).arrayBuffer();
}
