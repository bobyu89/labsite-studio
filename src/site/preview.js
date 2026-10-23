// Builds a self-contained preview document for a real site page: relative
// stylesheets and scripts are inlined, images become blob URLs, decorative
// animation scripts are skipped, and a tiny bridge reports clicks back.
import { parsePage, sectionElements, pathOf, isPhotoSlot } from "./page.js";
import { resolveFrom } from "./source.js";
import { previewCard } from "./embeds.js";

const SKIP_SCRIPTS = /(^|\/)(micro\.js|vendor\/anime[^/]*\.js)$/;
const BRIDGE = `
<style id="labsite-bridge-style">
  [data-ls]{transition:outline-color .15s}
  [data-ls]:hover{outline:2px dashed rgba(13,101,87,.55);outline-offset:2px;cursor:pointer}
  [data-ls].ls-selected{outline:3px solid #0d6557 !important;outline-offset:3px}
  section[data-ls].ls-selected{outline-offset:-3px}
  html{scroll-behavior:auto !important}
  .ls-drop{outline:4px dashed #0d6557 !important;outline-offset:-4px;filter:brightness(1.06)}
  .ls-embed iframe{pointer-events:none}
  html.ls-inline [data-ls-text]:hover{cursor:text}
  [data-ls-editing]{outline:2px solid #0d6557 !important;outline-offset:3px;background:rgba(13,101,87,.07);cursor:text;-webkit-user-modify:read-write-plaintext-only}
</style>
<script id="labsite-bridge">
(function(){
  var post=function(m){parent.postMessage(Object.assign({source:"labsite"},m),"*")};
  document.addEventListener("click",function(e){
    var a=e.target.closest("a[href]");
    if(a){e.preventDefault();}
    var el=e.target.closest("[data-ls]");
    // typing: the press started typing here, so the editor must not move
    // the keyboard focus to its own field.
    if(el){e.preventDefault();post({type:"select",id:el.getAttribute("data-ls"),typing:!!(editing&&editing.contains(e.target))});return;}
    if(a){post({type:"navigate",href:a.getAttribute("href")});}
  },true);
  document.addEventListener("submit",function(e){e.preventDefault()},true);
  // Drop a photo on an image in the preview to replace it. The File is sent
  // to the editor (structured clone), which compresses and stages it.
  var hasFiles=function(e){return e.dataTransfer&&[].indexOf.call(e.dataTransfer.types||[],"Files")>=0};
  var clearDrop=function(keep){document.querySelectorAll(".ls-drop").forEach(function(n){if(n!==keep)n.classList.remove("ls-drop")})};
  document.addEventListener("dragover",function(e){
    if(!hasFiles(e))return;e.preventDefault();
    var img=e.target.closest&&e.target.closest("img[data-ls],[data-ls-photo][data-ls]");clearDrop(img);
    if(img){img.classList.add("ls-drop");e.dataTransfer.dropEffect="copy"}else{e.dataTransfer.dropEffect="none"}
  },true);
  document.addEventListener("dragleave",function(e){if(!e.relatedTarget)clearDrop(null)},true);
  document.addEventListener("drop",function(e){
    if(!hasFiles(e))return;e.preventDefault();clearDrop(null);
    var img=e.target.closest&&e.target.closest("img[data-ls],[data-ls-photo][data-ls]");var f=e.dataTransfer.files[0];
    if(img&&f)post({type:"drop",id:img.getAttribute("data-ls"),file:f});
  },true);
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
  // Type straight into the page: pressing on a text ([data-ls-text]) makes it
  // editable in place. Every text node under it is reported as
  // [path from the element, value when editing began, value now]; if the
  // browser merged or removed nodes (formatting was deleted), the edit is
  // reported as broken and the editor reloads the preview.
  if(window.__lsInline){
    document.documentElement.classList.add("ls-inline");
    var editing=null,orig=null,timer=null;
    var plain=(function(){var d=document.createElement("div");try{d.contentEditable="plaintext-only"}catch(x){return false}return d.contentEditable==="plaintext-only"})();
    var texts=function(el){var out=[];(function walk(n,path){for(var i=0;i<n.childNodes.length;i++){var c=n.childNodes[i];if(c.nodeType===3)out.push({node:c,path:path.concat(i),value:c.nodeValue});else if(c.nodeType===1&&!/^(SCRIPT|STYLE)$/.test(c.tagName))walk(c,path.concat(i))}})(el,[]);return out};
    var report=function(){
      if(!editing)return;var now=texts(editing),ok=now.length===orig.length;
      for(var i=0;ok&&i<now.length;i++)if(now[i].node!==orig[i].node)ok=false;
      if(!ok){post({type:"inline-broken"});return}
      post({type:"inline",id:editing.getAttribute("data-ls"),changes:orig.map(function(o){return[o.path,o.value,o.node.nodeValue]})});
    };
    var onInput=function(){clearTimeout(timer);timer=setTimeout(report,250)};
    var onKey=function(e){
      if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();editing&&editing.blur()}
      else if(e.key==="Escape"){e.preventDefault();orig.forEach(function(o){o.node.nodeValue=o.value});editing&&editing.blur()}
    };
    var onPaste=function(e){e.preventDefault();var t=(e.clipboardData||window.clipboardData).getData("text");document.execCommand("insertText",false,t.replace(/\\s+/g," "))};
    var onBefore=function(e){if(/^format|^insert(Paragraph|OrderedList|UnorderedList|HorizontalRule|Image|Link)/.test(e.inputType||""))e.preventDefault()};
    var finish=function(){
      if(!editing)return;clearTimeout(timer);report();
      var el=editing;editing=null;
      el.removeAttribute("contenteditable");el.removeAttribute("data-ls-editing");
      el.removeEventListener("input",onInput);el.removeEventListener("keydown",onKey);el.removeEventListener("blur",finish);
      el.removeEventListener("paste",onPaste);el.removeEventListener("beforeinput",onBefore);
      post({type:"inline-end"});
    };
    var start=function(el){
      if(editing===el)return;finish();editing=el;orig=texts(el);
      el.setAttribute("contenteditable",plain?"plaintext-only":"true");el.setAttribute("data-ls-editing","");
      el.addEventListener("input",onInput);el.addEventListener("keydown",onKey);el.addEventListener("blur",finish);
      el.addEventListener("paste",onPaste);el.addEventListener("beforeinput",onBefore);
    };
    document.addEventListener("pointerdown",function(e){
      var el=e.target.closest&&e.target.closest("[data-ls-text]");
      if(!el){if(editing&&!editing.contains(e.target))editing.blur();return}
      if(editing&&editing.contains(el))return;
      start(el);
    },true);
  }
  post({type:"ready"});
})();
</script>`;

// Text that can be typed into in place: an element holding only text and
// inline markup (no images, blocks or controls), and not a number the site's
// scripts animate.
const INLINE = new Set(["span", "a", "strong", "em", "b", "i", "small", "code", "sup", "sub", "br", "time", "mark", "abbr", "u", "s", "q", "cite"]);
const TEXT_HOSTS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dt", "dd", "td", "th", "figcaption", "blockquote", "label", "button", "summary", "caption", "div", ...INLINE]);
function isInlineText(el) {
  const tag = el.tagName.toLowerCase();
  if (!TEXT_HOSTS.has(tag) || tag === "br" || !el.textContent.trim() || isPhotoSlot(el)) return false;
  if (el.closest("[data-count], .stat__value, .ls-stat, .ls-progress-value, svg")) return false;
  return [...el.querySelectorAll("*")].every((c) => INLINE.has(c.tagName.toLowerCase()));
}
// Stamps data-ls ids on sections and on every element that owns editable text.
function stamp(doc) {
  sectionElements(doc).forEach((section, i) => {
    section.setAttribute("data-ls", "s" + i);
    section.querySelectorAll("*").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "svg", "path", "g", "defs", "stop", "rect", "circle", "lineargradient"].includes(tag)) return;
      if (el.closest("svg")) return;
      const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (isPhotoSlot(el)) el.setAttribute("data-ls-photo", "");
      if (ownsText || tag === "img" || tag === "a" || tag === "li" || tag === "tr" || /\bcard\b|chip|ls-embed/.test(el.getAttribute("class") || "")) {
        const path = pathOf(el, section);
        if (path) {
          el.setAttribute("data-ls", "s" + i + "/" + path.join("."));
          if (isInlineText(el)) el.setAttribute("data-ls-text", "");
        }
      }
    });
  });
}

// Runs inside the preview (serialized with toString: plain ES5 only).
function askForImages() {
  var waiting = {};
  var ask = function (img) {
    var src = img.getAttribute("src");
    if (!src || /^(data:|blob:|https?:|\/\/)/i.test(src)) return;
    if (!waiting[src]) {
      waiting[src] = [];
      parent.postMessage({ source: "labsite", type: "image", src: src }, "*");
    }
    if (waiting[src].indexOf(img) < 0) waiting[src].push(img);
  };
  window.addEventListener("message", function (e) {
    var m = e.data || {};
    if (m.source !== "labsite-host" || m.type !== "image" || !waiting[m.src]) return;
    waiting[m.src].forEach(function (img) {
      if (img.getAttribute("src") === m.src) img.setAttribute("src", m.url);
    });
    delete waiting[m.src];
  });
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (m.type === "attributes") {
        if (m.target.tagName === "IMG") ask(m.target);
        return;
      }
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === "IMG") ask(n);
        if (n.querySelectorAll) n.querySelectorAll("img").forEach(ask);
      });
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
}
// The data: URL for an image the preview asked for (null when missing).
export function previewImageUrl(source, cache, path) {
  if (!cache.urls.has(path))
    cache.urls.set(
      path,
      source
        .readBlob(path)
        .then((b) => toDataUrl(b, path))
        .catch(() => null),
    );
  return cache.urls.get(path);
}

export async function buildPreview({ html, pagePath, source, cache, scrollY = 0, playMotion = false, inline = false }) {
  const { doc } = parsePage(html);
  stamp(doc);
  // Video and map players cannot run in the sandboxed preview: show a card.
  for (const frame of [...doc.querySelectorAll(".ls-embed > iframe")]) {
    const holder = doc.createElement("div");
    frame.replaceWith(holder);
    holder.outerHTML = previewCard(frame.getAttribute("src") || "");
  }
  const missing = [];
  const text = async (path) => {
    if (!cache.text.has(path)) cache.text.set(path, source.readText(path).catch(() => null));
    return cache.text.get(path);
  };
  // Images become data: URLs, not blob: URLs — the preview iframe runs in an
  // isolated (opaque) origin, which cannot load the editor's blob: URLs.
  const blobUrl = async (path) => {
    if (!cache.urls.has(path))
      cache.urls.set(
        path,
        source
          .readBlob(path)
          .then((b) => toDataUrl(b, path))
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
  // Images the site's scripts add later (album photos listed in js/data.js)
  // cannot load in the isolated preview either: the preview asks the editor
  // for each one as it appears (see previewImageUrl).
  const asker = doc.createElement("script");
  asker.textContent = "(" + askForImages.toString() + ")();";
  doc.head.prepend(asker);
  // Album blocks read data/albums.json, which the isolated preview cannot
  // fetch: hand it the (possibly unsaved) albums directly.
  if (doc.querySelector(".ls-album")) {
    const albums = await text("data/albums.json");
    let json = null;
    try {
      json = albums === null ? null : JSON.stringify(JSON.parse(albums));
    } catch {
      json = null;
    }
    if (json) {
      const data = doc.createElement("script");
      data.textContent = "window.__lsAlbums=" + json.replace(/</g, "\\u003c") + ";";
      doc.head.prepend(data);
    }
  }
  const init = doc.createElement("script");
  // playMotion lets the site's own scripts run their entrance animations
  // once (they normally stay still inside the editor).
  init.textContent =
    "window.__lsScroll=" + (playMotion ? 0 : Math.max(0, Math.floor(scrollY))) + ";" + (playMotion ? "window.__lsMotion=1;" : "") + (inline ? "window.__lsInline=1;" : "");
  doc.head.prepend(init);
  doc.body.insertAdjacentHTML("beforeend", BRIDGE);
  return {
    srcdoc: "<!DOCTYPE html>\n" + doc.documentElement.outerHTML,
    missing: [...new Set(missing)],
  };
}
const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};
export async function toDataUrl(blob, path) {
  const ext = String(path).split(".").pop().toLowerCase();
  const type = IMAGE_TYPES[ext] || (/^image\//.test(blob.type) ? blob.type : "application/octet-stream");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return "data:" + type + ";base64," + btoa(bin);
}
export function createPreviewCache() {
  return { text: new Map(), urls: new Map() };
}
export function invalidatePreviewCache(cache, path) {
  cache.text.delete(path);
  cache.urls.delete(path);
}
