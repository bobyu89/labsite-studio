// 海報用 QR Code: this page or the home page, as SVG (for print) or PNG.
import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { DownloadSimple } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { qrSvg, publicPageUrl } from "../site/qr.js";

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function QrDialog({ open, onClose, siteUrl, page, label, slug }) {
  const [which, setWhich] = useState("page");
  const url = publicPageUrl(siteUrl, which === "home" ? "index.html" : page);
  const svg = useMemo(() => qrSvg(url), [url]);
  const name = `QR-${slug || "site"}-${which === "home" ? "home" : String(page).replace(/\.html?$/, "").replace(/\//g, "-")}`;
  const png = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 1200;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, 1200, 1200);
      c.toBlob((b) => b && save(b, name + ".png"), "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  return (
    <Modal open={open} onClose={onClose} title="QR Code" description="放在海報、簡報或名片上，掃描就會打開網站。">
      <div className="qr-dialog">
        <div className="qr-choice" role="radiogroup" aria-label="連到哪裡">
          <label>
            <input type="radio" checked={which === "page"} onChange={() => setWhich("page")} /> 這一頁（{label}）
          </label>
          <label>
            <input type="radio" checked={which === "home"} onChange={() => setWhich("home")} /> 網站首頁
          </label>
        </div>
        <div className="qr-image" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="qr-url">{url}</p>
        <div className="quick-add-actions">
          <Button size="3" onClick={() => save(new Blob([svg], { type: "image/svg+xml" }), name + ".svg")}>
            <DownloadSimple size={18} /> 下載 SVG（印刷用）
          </Button>
          <Button size="3" variant="soft" onClick={png}>
            <DownloadSimple size={18} /> 下載 PNG
          </Button>
        </div>
        <p className="small-note">網站要先發布，掃描後看到的才會是最新內容。</p>
      </div>
    </Modal>
  );
}
