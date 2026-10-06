// Templates for new sites. The editor build ships each template as one JSON
// bundle (dist/templates/<id>.json, made by vite.config.js from templates/<id>/),
// so the API reads a whole template with a single asset fetch.
//   { id, name, description, files: [{ path, text } | { path, base64 }] }
import { RepoError } from "./repo.js";
import { enc, dec, fromBase64 } from "./bytes.js";
import { patchSiteField, readSiteFields } from "../../src/site/siteData.js";

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export async function templateFiles(env, requestUrl, id) {
  if (!ID.test(String(id || ""))) throw new RepoError(400, "模板代號不正確：" + id);
  if (!env.ASSETS) throw new RepoError(500, "這個環境沒有提供模板。");
  const res = await env.ASSETS.fetch(new Request(new URL(`/templates/${id}.json`, requestUrl)));
  // Unknown asset paths fall back to the editor page (single-page app), so a
  // missing template shows up as HTML rather than a 404.
  if (!res.ok || !(res.headers.get("Content-Type") || "").includes("json")) throw new RepoError(404, "找不到模板：" + id);
  const bundle = await res.json().catch(() => null);
  if (!bundle || !Array.isArray(bundle.files) || !bundle.files.length) throw new RepoError(500, "模板內容不完整：" + id);
  return bundle.files.map((f) => ({
    path: f.path,
    bytes: typeof f.base64 === "string" ? fromBase64(f.base64) : enc.encode(String(f.text ?? "")),
  }));
}

// Puts the new lab's name everywhere the template used its placeholder name
// (labsite/template.json → placeholder.nameZh): page titles, headings,
// snippets and js/data.js. Without that metadata only SITE.nameZh is set.
const TEXT = /\.(html?|js|css|json|svg|txt|xml|md)$/i;
export function personalize(files, { name }) {
  const label = String(name || "").trim();
  if (!label) return files;
  let placeholder = "";
  const meta = files.find((f) => f.path === "labsite/template.json");
  if (meta) {
    try {
      placeholder = String(JSON.parse(dec.decode(meta.bytes)).placeholder?.nameZh || "");
    } catch {
      placeholder = "";
    }
  }
  return files.map((f) => {
    if (!TEXT.test(f.path) || f.path === "labsite/template.json") return f;
    let text = dec.decode(f.bytes);
    const before = text;
    if (placeholder) text = text.split(placeholder).join(label);
    else if (f.path === "js/data.js" && readSiteFields(text).fields.some((x) => x.key === "nameZh"))
      text = patchSiteField(text, "nameZh", label);
    return text === before ? f : { ...f, bytes: enc.encode(text) };
  });
}
