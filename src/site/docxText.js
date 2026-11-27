// The text of a Word (.docx) file, read in the browser: a .docx is a zip
// whose word/document.xml holds the paragraphs. Enough of a zip reader for
// that one entry (stored or deflated), with the browser's DecompressionStream.

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

// → Uint8Array of the entry, or null.
export async function zipEntry(bytes, name) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (u32(b, i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) return null;
  const count = u16(b, end + 10);
  let at = u32(b, end + 16);
  for (let n = 0; n < count && at + 46 <= b.length; n++) {
    if (u32(b, at) !== 0x02014b50) return null;
    const method = u16(b, at + 10);
    const size = u32(b, at + 20);
    const nameLen = u16(b, at + 28);
    const extra = u16(b, at + 30);
    const comment = u16(b, at + 32);
    const local = u32(b, at + 42);
    const entry = new TextDecoder().decode(b.subarray(at + 46, at + 46 + nameLen));
    if (entry === name) {
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const data = b.subarray(start, start + size);
      if (method === 0) return data;
      if (method !== 8) return null;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    at += 46 + nameLen + extra + comment;
  }
  return null;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
// document.xml → paragraphs as lines (tabs and breaks kept as spaces / lines).
export function documentText(xml) {
  return String(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function docxText(file) {
  const xml = await zipEntry(new Uint8Array(await file.arrayBuffer()), "word/document.xml");
  if (!xml) throw new Error("讀不到這個 Word 檔。請另存成 .docx，或改存成 PDF。");
  return documentText(new TextDecoder().decode(xml));
}
