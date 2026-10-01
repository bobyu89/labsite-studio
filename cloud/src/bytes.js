// Byte helpers shared by the API and the public site worker. Runs unchanged in
// Workers and Node (both have Web Crypto, TextEncoder, atob/btoa).
export const enc = new TextEncoder();
export const dec = new TextDecoder();

export const toBytes = (v) =>
  v instanceof Uint8Array ? v : typeof v === "string" ? enc.encode(v) : new Uint8Array(v);

export async function sha256Hex(v) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", toBytes(v)));
  let out = "";
  for (const b of digest) out += b.toString(16).padStart(2, "0");
  return out;
}

export function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const base64UrlToBytes = (s) =>
  fromBase64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export const randomId = (bytes = 8) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
