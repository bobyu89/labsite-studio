import React, { useEffect, useRef, useState } from "react";
import { Desktop, DeviceMobile, ArrowsClockwise, Play, Columns } from "@phosphor-icons/react";
import { IconButton } from "./ui";
import { buildPreview, previewImageUrl } from "../site/preview.js";
import { resolveFrom, isPagePath } from "../site/source.js";

// 並排 shows the page at a computer's width, scaled down to fit, next to a phone.
const DESKTOP_WIDTH = 1200;
const PHONE_WIDTH = 390;
const SIDE_BY_SIDE = "(min-width: 1280px)";

// The size of an element's box, kept up to date.
function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}
// An iframe laid out `width` px wide and scaled to fill its box.
const fit = (box, width) => {
  if (!box.w || !box.h) return { width, height: 600, transform: "scale(0.1)", transformOrigin: "0 0" };
  const scale = Math.min(1, box.w / width);
  return { width: box.w / scale, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: "0 0" };
};
function useMatch(query) {
  const [on, setOn] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(query);
    const change = () => setOn(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, [query]);
  return on;
}

// The same page at phone width. A view to check the layout and to click:
// selecting works, typing stays in the main preview.
function PhoneView({ html, pagePath, source, cache, pages, highlightId, onSelect, onNavigate, reloads }) {
  const frame = useRef();
  const wrap = useRef();
  const box = useBox(wrap);
  const [srcdoc, setSrcdoc] = useState("");
  const scroll = useRef({});
  const latest = useRef(0);
  useEffect(() => {
    if (!html || !pagePath) return;
    const id = ++latest.current;
    // Follows a little behind the main preview, so typing there stays smooth.
    const t = setTimeout(async () => {
      const out = await buildPreview({ html, pagePath, source, cache, scrollY: scroll.current[pagePath] || 0 }).catch(() => null);
      if (out && id === latest.current) setSrcdoc(out.srcdoc);
    }, 700);
    return () => clearTimeout(t);
  }, [html, pagePath, source, cache]);
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data || {};
      if (m.source !== "labsite") return;
      if (m.type === "ready") frame.current.contentWindow.postMessage({ source: "labsite-host", type: "highlight", id: highlightId, scroll: true }, "*");
      else if (m.type === "select") {
        const [s, path] = String(m.id).split("/");
        onSelect(Number(s.slice(1)), path || null, false);
      } else if (m.type === "navigate") {
        const target = resolveFrom(pagePath, m.href);
        if (target && isPagePath(target) && pages.includes(target)) onNavigate(target);
        else if (target && pages.includes(target + "/index.html")) onNavigate(target + "/index.html");
      } else if (m.type === "image" && typeof m.src === "string") {
        const path = resolveFrom(pagePath, m.src);
        const win = frame.current.contentWindow;
        if (path && /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(path))
          previewImageUrl(source, cache, path).then((url) => {
            if (url) win?.postMessage({ source: "labsite-host", type: "image", src: m.src, url }, "*");
          });
      } else if (m.type === "scroll") scroll.current[pagePath] = m.y;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pagePath, pages, onSelect, onNavigate, highlightId, source, cache]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ source: "labsite-host", type: "highlight", id: highlightId, scroll: true }, "*");
  }, [highlightId]);
  return (
    <div className="frame-phone" ref={wrap}>
      <iframe key={reloads} ref={frame} title="手機尺寸預覽" srcDoc={srcdoc} sandbox="allow-scripts" style={fit(box, PHONE_WIDTH)} />
    </div>
  );
}

// Renders the real page with its own CSS and scripts. Clicking an element in
// the preview selects the matching section and field in the inspector.
export default function SitePreview({
  html,
  pagePath,
  source,
  cache,
  scrolls,
  pages,
  selected,
  focus,
  onSelect,
  onNavigate,
  onDropImage,
  onInline,
  onInlineBroken,
  canPlayMotion = false,
  device,
  setDevice,
}) {
  const frame = useRef();
  const mainWrap = useRef();
  const mainBox = useBox(mainWrap);
  // 並排 needs room for two previews; on a narrower window it shows the computer view.
  const roomy = useMatch(SIDE_BY_SIDE);
  const view = device === "both" && !roomy ? "desktop" : device;
  const [srcdoc, setSrcdoc] = useState("");
  const [reloads, setReloads] = useState(0);
  const [missing, setMissing] = useState([]);
  const [stale, setStale] = useState(false);
  const latest = useRef(0);
  // 播放動畫: rebuild once with the site's entrance animations switched on.
  const [motionTick, setMotionTick] = useState(0);
  const playedTick = useRef(0);
  // Text typed in the preview is already on screen: the page change it causes
  // must not rebuild the preview (that would drop the cursor).
  const typed = useRef(false);
  const built = useRef({});
  const [rebuild, setRebuild] = useState(0);
  const inline = !!onInline;
  useEffect(() => {
    if (!html || !pagePath) return;
    const b = built.current;
    if (typed.current && b.pagePath === pagePath && b.source === source && b.motionTick === motionTick && b.rebuild === rebuild && b.inline === inline) {
      typed.current = false;
      return;
    }
    typed.current = false;
    built.current = { pagePath, source, motionTick, rebuild, inline };
    setStale(true);
    const id = ++latest.current;
    const playMotion = motionTick !== playedTick.current;
    playedTick.current = motionTick;
    const t = setTimeout(async () => {
      try {
        const out = await buildPreview({
          html,
          pagePath,
          source,
          cache,
          scrollY: scrolls[pagePath] || 0,
          playMotion,
          inline,
        });
        if (id !== latest.current) return;
        setSrcdoc(out.srcdoc);
        setMissing(out.missing);
      } finally {
        if (id === latest.current) setStale(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [html, pagePath, source, cache, scrolls, motionTick, rebuild, inline]);

  const highlightId =
    selected === null || selected === undefined
      ? null
      : focus
        ? "s" + selected + "/" + focus
        : "s" + selected;
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data || {};
      if (m.source !== "labsite") return;
      if (m.type === "ready") {
        frame.current.contentWindow.postMessage(
          { source: "labsite-host", type: "highlight", id: highlightId, scroll: false },
          "*",
        );
      } else if (m.type === "select") {
        const [s, path] = String(m.id).split("/");
        onSelect(Number(s.slice(1)), path || null, !!m.typing);
      } else if (m.type === "navigate") {
        const target = resolveFrom(pagePath, m.href);
        if (target && isPagePath(target) && pages.includes(target)) onNavigate(target);
        else if (target && pages.includes(target + "/index.html")) onNavigate(target + "/index.html");
      } else if (m.type === "inline" && onInline && Array.isArray(m.changes)) {
        const [s, path] = String(m.id).split("/");
        if (path && onInline(Number(s.slice(1)), path.split(".").map(Number), m.changes)) typed.current = true;
      } else if (m.type === "inline-broken") {
        // Formatting was deleted while typing: show the saved page again.
        onInlineBroken?.();
        setRebuild((n) => n + 1);
      } else if (m.type === "drop" && onDropImage && m.file) {
        const [s, path] = String(m.id).split("/");
        if (path) onDropImage(Number(s.slice(1)), path.split(".").map(Number), m.file);
      } else if (m.type === "image" && typeof m.src === "string") {
        // An image the site's script added (e.g. album photos): send its data.
        const path = resolveFrom(pagePath, m.src);
        const win = frame.current.contentWindow;
        if (path && /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(path))
          previewImageUrl(source, cache, path).then((url) => {
            if (url) win?.postMessage({ source: "labsite-host", type: "image", src: m.src, url }, "*");
          });
      } else if (m.type === "scroll") {
        scrolls[pagePath] = m.y;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pagePath, pages, onSelect, onNavigate, onDropImage, onInline, onInlineBroken, scrolls, highlightId, source, cache]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { source: "labsite-host", type: "highlight", id: highlightId, scroll: true },
      "*",
    );
  }, [highlightId]);

  return (
    <section className="editor-canvas">
      <div className="canvas-toolbar">
        <span>
          <span className={"status-dot" + (stale ? " pending" : "")} />
          {stale ? "更新預覽中…" : "真實網站預覽"}
          <span className="canvas-path">{pagePath}</span>
        </span>
        <div className="device-picker">
          {roomy && (
            <IconButton label="電腦和手機並排" aria-pressed={view === "both"} onClick={() => setDevice("both")}>
              <Columns size={19} />
            </IconButton>
          )}
          <IconButton label="電腦尺寸" aria-pressed={view === "desktop"} onClick={() => setDevice("desktop")}>
            <Desktop size={19} />
          </IconButton>
          <IconButton label="手機尺寸" aria-pressed={view === "mobile"} onClick={() => setDevice("mobile")}>
            <DeviceMobile size={19} />
          </IconButton>
          {canPlayMotion && (
            <IconButton label="播放動畫（從頁面頂端開始）" onClick={() => setMotionTick((n) => n + 1)}>
              <Play size={17} />
            </IconButton>
          )}
          <IconButton
            label="重新載入預覽"
            onClick={() => setReloads((n) => n + 1)}
          >
            <ArrowsClockwise size={18} />
          </IconButton>
        </div>
        <span className="canvas-dimension">{view === "mobile" ? "390 px" : view === "both" ? "電腦 ＋ 手機" : "自適應"}</span>
      </div>
      <div className={"canvas-frame " + view}>
        {/* No allow-same-origin: the site's own scripts run in an isolated
            origin, so they cannot read the editor's storage or call the
            LabSite API with the signed-in user's session. */}
        <div className="frame-main" ref={mainWrap}>
          <iframe
            key={reloads}
            ref={frame}
            title="真實網站預覽"
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            style={view === "both" ? fit(mainBox, DESKTOP_WIDTH) : undefined}
          />
        </div>
        {view === "both" && (
          <PhoneView
            html={html}
            pagePath={pagePath}
            source={source}
            cache={cache}
            pages={pages}
            highlightId={highlightId}
            onSelect={onSelect}
            onNavigate={onNavigate}
            reloads={reloads}
          />
        )}
      </div>
      <p className="canvas-caption">
        {inline ? "直接點預覽中的文字就能打字（Enter 完成、Esc 取消）；" : "點預覽中的文字或圖片就會跳到它的編輯欄位；"}
        預覽會執行網站自己的腳本，最新消息與照片來自線上來源。
        {missing.length > 0 && <> 找不到：{missing.join("、")}</>}
      </p>
    </section>
  );
}
