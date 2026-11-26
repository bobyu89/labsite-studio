// The wizard's live preview: one page of the template as it would be built
// (skin, colours, drafts, name), made into a single HTML document — styles,
// scripts and pictures inlined — for an <iframe srcdoc>.
import { buildWizardSite } from "./wizard.js";

// bundle: /templates/<id>.json → Map(path → text) plus raw images.
export function bundleFiles(bundle) {
  const texts = new Map();
  const binary = new Map();
  for (const f of bundle.files || []) {
    if (typeof f.text === "string") texts.set(f.path, f.text);
    else if (typeof f.base64 === "string") binary.set(f.path, f.base64);
  }
  return { texts, binary };
}

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

export function previewHtml(bundle, { page = "index.html", skin, name, wizard }) {
  const { texts, binary } = bundleFiles(bundle);
  let files = new Map(texts);
  // Skin: its site.css / theme.css become the site's.
  if (skin && files.has(`labsite/skins/${skin}/site.css`)) {
    files.set("css/site.css", files.get(`labsite/skins/${skin}/site.css`));
    files.set("css/theme.css", files.get(`labsite/skins/${skin}/theme.css`));
  }
  let meta = {};
  try {
    meta = JSON.parse(files.get("labsite/template.json") || "{}");
  } catch {
    meta = {};
  }
  const placeholder = meta.placeholder?.nameZh;
  if (placeholder && name) for (const [p, t] of files) if (/\.(html|js)$/.test(p)) files.set(p, t.split(placeholder).join(name));
  files = buildWizardSite(files, meta, wizard || {});
  let html = files.get(page);
  if (!html) return null;
  const dir = page.includes("/") ? page.slice(0, page.lastIndexOf("/") + 1) : "";
  const resolve = (src) => {
    const parts = (dir + src).split("/");
    const out = [];
    for (const s of parts) {
      if (s === "..") out.pop();
      else if (s && s !== ".") out.push(s);
    }
    return out.join("/");
  };
  const dataUrl = (path) => {
    const ext = (path.split(".").pop() || "").toLowerCase();
    if (files.has(path)) return `data:${MIME[ext] || "text/plain"};charset=utf-8,${encodeURIComponent(files.get(path))}`;
    if (binary.has(path)) return `data:${MIME[ext] || "application/octet-stream"};base64,${binary.get(path)}`;
    return null;
  };
  html = html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g, (tag, href) => {
    const css = files.get(resolve(href));
    return css === undefined ? tag : `<style>${css}</style>`;
  });
  html = html.replace(/<script\b([^>]*)src="([^"]+\.js)"([^>]*)><\/script>/g, (tag, a, src) => {
    const js = files.get(resolve(src));
    return js === undefined ? tag : `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
  });
  html = html.replace(/(<img\b[^>]*\ssrc=")([^"]+)(")/g, (tag, a, src, b) => {
    if (/^(https?:|data:)/.test(src)) return tag;
    const url = dataUrl(resolve(src));
    return url ? a + url + b : tag;
  });
  // Links inside the preview go nowhere.
  return html.replace("</head>", "<style>a{pointer-events:none}</style><base target=\"_blank\"></head>");
}

