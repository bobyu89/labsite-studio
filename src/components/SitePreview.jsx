import React, { useEffect, useRef, useState } from "react";
import { Desktop, DeviceMobile, ArrowsClockwise, Play } from "@phosphor-icons/react";
import { IconButton } from "./ui";
import { buildPreview } from "../site/preview.js";
import { resolveFrom, isPagePath } from "../site/source.js";

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
  canPlayMotion = false,
  device,
  setDevice,
}) {
  const frame = useRef();
  const [srcdoc, setSrcdoc] = useState("");
  const [reloads, setReloads] = useState(0);
  const [missing, setMissing] = useState([]);
  const [stale, setStale] = useState(false);
  const latest = useRef(0);
  // 播放動畫: rebuild once with the site's entrance animations switched on.
  const [motionTick, setMotionTick] = useState(0);
  const playedTick = useRef(0);
  useEffect(() => {
    if (!html || !pagePath) return;
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
        });
        if (id !== latest.current) return;
        setSrcdoc(out.srcdoc);
        setMissing(out.missing);
      } finally {
        if (id === latest.current) setStale(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [html, pagePath, source, cache, scrolls, motionTick]);

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
        onSelect(Number(s.slice(1)), path || null);
      } else if (m.type === "navigate") {
        const target = resolveFrom(pagePath, m.href);
        if (target && isPagePath(target) && pages.includes(target)) onNavigate(target);
        else if (target && pages.includes(target + "/index.html")) onNavigate(target + "/index.html");
      } else if (m.type === "drop" && onDropImage && m.file) {
        const [s, path] = String(m.id).split("/");
        if (path) onDropImage(Number(s.slice(1)), path.split(".").map(Number), m.file);
      } else if (m.type === "scroll") {
        scrolls[pagePath] = m.y;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pagePath, pages, onSelect, onNavigate, onDropImage, scrolls, highlightId]);
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
          <IconButton label="桌面尺寸" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            <Desktop size={19} />
          </IconButton>
          <IconButton label="手機尺寸" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
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
        <span className="canvas-dimension">{device === "mobile" ? "390 px" : "自適應"}</span>
      </div>
      <div className={"canvas-frame " + device}>
        {/* No allow-same-origin: the site's own scripts run in an isolated
            origin, so they cannot read the editor's storage or call the
            LabSite API with the signed-in user's session. */}
        <iframe key={reloads} ref={frame} title="真實網站預覽" srcDoc={srcdoc} sandbox="allow-scripts" />
      </div>
      <p className="canvas-caption">
        點預覽中的文字或圖片即可在左側編輯；預覽會執行網站自己的腳本，最新消息與照片來自線上來源。
        {missing.length > 0 && <> 找不到：{missing.join("、")}</>}
      </p>
    </section>
  );
}
