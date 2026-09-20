import React from "react";
import { Desktop, DeviceMobile } from "@phosphor-icons/react";
import { IconButton } from "./ui";
export default function PreviewCanvas({ doc, device, setDevice }) {
  return (
    <section className="editor-canvas">
      <div className="canvas-toolbar">
        <span>
          <span className="status-dot" />
          即時草稿預覽
        </span>
        <div className="device-picker">
          <IconButton
            label="桌面尺寸"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Desktop size={19} />
          </IconButton>
          <IconButton
            label="手機尺寸"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <DeviceMobile size={19} />
          </IconButton>
        </div>
        <span className="canvas-dimension">
          {device === "mobile" ? "390 px" : "自適應"}
        </span>
      </div>
      <div className={"canvas-frame " + device}>
        <iframe
          title="編輯中的網站預覽"
          srcDoc={doc}
          sandbox="allow-same-origin"
        />
      </div>
      <p className="canvas-caption">
        此預覽與匯出網站使用相同的呈現元件與主題。
      </p>
    </section>
  );
}
