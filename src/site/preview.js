// Builds a self-contained preview document for a real site page: relative
// stylesheets and scripts are inlined, images become blob URLs, decorative
// animation scripts are skipped, and a tiny bridge reports clicks back.
import { parsePage, sectionElements, pathOf } from "./page.js";
import { resolveFrom } from "./source.js";

const SKIP_SCRIPTS = /(^|\/)(micro\.js|vendor\/anime[^/]*\.js)$/;
const BRIDGE = `
<style id="labsite-bridge-style">
  [data-ls]{transition:outline-color .15s}
  [data-ls]:hover{outline:2px dashed rgba(13,101,87,.55);outline-offset:2px;cursor:pointer}
  [data-ls].ls-selected{outline:3px solid #0d6557 !important;outline-offset:3px}
  section[data-ls].ls-selected{outline-offset:-3px}
  html{scroll-behavior:auto !important}
</style>
<script id="labsite-bridge">
(function(){
  var post=function(m){parent.postMessage(Object.assign({source:"labsite"},m),"*")};
  document.addEventListener("click",function(e){
    var a=e.target.closest("a[href]");
    if(a){e.preventDefault();}
    var el=e.target.closest("[data-ls]");
    if(el){e.preventDefault();post({type:"select",id:el.getAttribute("data-ls")});return;}
    if(a){post({type:"navigate",href:a.getAttribute("href")});}
  },true);
  document.addEventListener("submit",function(e){e.preventDefault()},true);
  var t;window.addEventListener("scroll",function(){clearTimeout(t);t=setTimeout(function(){post({type:"scroll",y:window.scrollY})},120)},{passive:true});
  window.addEventListener("message",function(e){
    var m=e.data||{};if(m.source!=="labsite-host")return;
    if(m.type==="highlight"){
      document.querySelectorAll(".ls-selected").forEach(function(n){n.classList.remove("ls-selected")});
      if(!m.id)return;var el=document.querySelector('[data-ls="'+m.id+'"]');
      if(el){el.classList.add("ls-selected");if(m.scroll){var r=el.getBoundingClientRect();if(r.top<0||r.bottom>window.innerHeight)window.scrollTo(0,window.scrollY+r.top-Math.max(40,(window.innerHeight-r.height)/2));}}
    }
    if(m.type==="scrollTo"){window.scrollTo(0,m.y||0)}
  });
  if(window.__lsScroll){window.addEventListener("load",function(){window.scrollTo(0,window.__lsScroll)})}
  post({type:"ready"});
})();
</script>`;

// Stamps data-ls ids on sections and on every element that owns editable text.
function stamp(doc) {
  sectionElements(doc).forEach((section, i) => {
    section.setAttribute("data-ls", "s" + i);
    section.querySelectorAll("*").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "svg", "path", "g", "defs", "stop", "rect", "circle", "lineargradient"].includes(tag)) return;
      if (el.closest("svg")) return;
      const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (ownsText || tag === "img" || tag === "a") {
        const path = pathOf(el, section);
        if (path) el.setAttribute("data-ls", "s" + i + "/" + path.join("."));
      }
    });
  });
}

export async function buildPreview({ html, pagePath, source, cache, scrollY = 0 }) {
  const { doc } = parsePage(html);
  stamp(doc);
  const missing = [];
  const text = async (path) => {
    if (!cache.text.has(path)) cache.text.set(path, source.readText(path).catch(() => null));
    return cache.text.get(path);
  };
  const blobUrl = async (path) => {
    if (!cache.urls.has(path))
      cache.urls.set(
        path,
        source
          .readBlob(path)
          .then((b) => URL.createObjectURL(b))
          .catch(() => null),
      );
    return cache.urls.get(path);
  };
  for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href], link[rel~="icon"][href]')]) {
    const path = resolveFrom(pagePath, link.getAttribute("href"));
    if (!path) continue;
    if (link.getAttribute("rel").includes("stylesheet")) {
      const css = await text(path);
      if (css === null) {
        missing.push(path);
        continue;
      }
      const style = doc.createElement("style");
      style.textContent = css;
      link.replaceWith(style);
    } else {
      const url = await blobUrl(path);
      if (url) link.setAttribute("href", url);
    }
  }
  for (const script of [...doc.querySelectorAll("script[src]")]) {
    const src = script.getAttribute("src");
    const path = resolveFrom(pagePath, src);
    if (!path) continue;
    if (SKIP_SCRIPTS.test(path)) {
      script.remove();
      continue;
    }
    const js = await text(path);
    if (js === null) {
      missing.push(path);
      script.remove();
      continue;
    }
    const inline = doc.createElement("script");
    inline.textContent = js.replace(/<\/script/gi, "<\\/script");
    script.replaceWith(inline);
  }
  for (const img of [...doc.querySelectorAll("img[src], source[srcset]")]) {
    const attr = img.hasAttribute("src") ? "src" : "srcset";
    const path = resolveFrom(pagePath, img.getAttribute(attr));
    if (!path) continue;
    const url = await blobUrl(path);
    if (url) img.setAttribute(attr, url);
    else missing.push(path);
  }
  const init = doc.createElement("script");
  init.textContent = "window.__lsScroll=" + Math.max(0, Math.floor(scrollY)) + ";";
  doc.head.prepend(init);
  doc.body.insertAdjacentHTML("beforeend", BRIDGE);
  return {
    srcdoc: "<!DOCTYPE html>\n" + doc.documentElement.outerHTML,
    missing: [...new Set(missing)],
  };
}
export function createPreviewCache() {
  return { text: new Map(), urls: new Map() };
}
export function invalidatePreviewCache(cache, path) {
  cache.text.delete(path);
  const url = cache.urls.get(path);
  if (url) {
    url.then((u) => u && URL.revokeObjectURL(u));
    cache.urls.delete(path);
  }
}
