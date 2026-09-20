import React, { useEffect, useRef, useState } from "react";
import { Desktop, DeviceMobile, ArrowsClockwise } from "@phosphor-icons/react";
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
  device,
  setDevice,
}) {
  const frame = useRef();
  const [srcdoc, setSrcdoc] = useState("");
  const [missing, setMissing] = useState([]);
  const [stale, setStale] = useState(false);
  const latest = useRef(0);
  useEffect(() => {
    if (!html || !pagePath) return;
    setStale(true);
    const id = ++latest.current;
    const t = setTimeout(async () => {
      try {
        const out = await buildPreview({
          html,
          pagePath,
          source,
          cache,
          scrollY: scrolls[pagePath] || 0,
        });
        if (id !== latest.current) return;
        setSrcdoc(out.srcdoc);
        setMissing(out.missing);
      } finally {
        if (id === latest.current) setStale(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [html, pagePath, source, cache, scrolls]);

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
      } else if (m.type === "scroll") {
        scrolls[pagePath] = m.y;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pagePath, pages, onSelect, onNavigate, scrolls, highlightId]);
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
          <IconButton
            label="重新載入預覽"
            onClick={() => {
              frame.current?.contentWindow?.location.reload();
            }}
          >
            <ArrowsClockwise size={18} />
          </IconButton>
        </div>
        <span className="canvas-dimension">{device === "mobile" ? "390 px" : "自適應"}</span>
      </div>
      <div className={"canvas-frame " + device}>
        <iframe
          ref={frame}
          title="真實網站預覽"
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <p className="canvas-caption">
        點預覽中的文字或圖片即可在左側編輯；預覽會執行網站自己的腳本，最新消息與照片來自線上來源。
        {missing.length > 0 && <> 找不到：{missing.join("、")}</>}
      </p>
    </section>
  );
}
