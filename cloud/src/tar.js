// Minimal tar reader for GitHub tarballs: regular files only, with the GNU
// long-name ('L') and pax ('x' path=) extensions GitHub uses for long paths.
import { dec } from "./bytes.js";

const field = (h, start, end) => dec.decode(h.subarray(start, end)).replace(/\0[\s\S]*$/, "");

export function parseTar(buf) {
  const files = [];
  let off = 0;
  let longName = null;
  let paxPath = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const size = parseInt(field(h, 124, 136).trim() || "0", 8) || 0;
    const type = h[156] === 0 ? "0" : String.fromCharCode(h[156]);
    let name = field(h, 0, 100);
    const magic = field(h, 257, 263);
    const prefix = magic.startsWith("ustar") ? field(h, 345, 500) : "";
    if (prefix) name = prefix + "/" + name;
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") {
      longName = dec.decode(body).replace(/\0[\s\S]*$/, "");
      continue;
    }
    if (type === "x") {
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(dec.decode(body));
      paxPath = m ? m[1] : null;
      continue;
    }
    if (type === "g") continue;
    const path = paxPath || longName || name;
    paxPath = longName = null;
    if (type === "0" || type === "7") files.push({ path, bytes: body.slice() });
  }
  return files;
}

// GitHub wraps everything in "<owner>-<repo>-<sha>/"; drop that first segment.
export function stripTopDir(files) {
  return files
    .map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }))
    .filter((f) => f.path);
}

export async function gunzip(stream) {
  const out = stream.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}
