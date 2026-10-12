// 動畫庫: every animated component as a live preview (the real runtime, in an
// isolated frame), grouped like a UI pattern dictionary; 插入 puts it on the
// page after the selected section.
import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Play, Plus } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { BLOCK_CATALOG, BLOCK_GROUPS } from "../site/blockCatalog.js";
import { RUNTIME_FILES, BLOCKS_CSS, BLOCKS_JS, PLACEHOLDER_PHOTO } from "../site/albums.js";
import { svgDataUrl } from "../site/assetLibrary.js";

const placeholder = svgDataUrl(RUNTIME_FILES[PLACEHOLDER_PHOTO]);
function previewDoc(block) {
  const html = block.html({ image: placeholder });
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:system-ui,"Microsoft JhengHei","PingFang TC",sans-serif;color:#24413a;background:#fff;font-size:14px}.ls-block{padding:18px 0}.ls-title{font-size:1.25em}
${RUNTIME_FILES[BLOCKS_CSS]}</style></head><body>${html}<script>${RUNTIME_FILES[BLOCKS_JS].replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

function Preview({ block }) {
  const [run, setRun] = useState(0);
  const doc = useMemo(() => previewDoc(block), [block]);
  return (
    <div className="anim-preview">
      {/* Isolated: no access to the editor (sandbox without same-origin). */}
      <iframe key={run} title={block.name + " 預覽"} srcDoc={doc} sandbox="allow-scripts" loading="lazy" />
      <button type="button" className="anim-replay" onClick={() => setRun((n) => n + 1)} aria-label={"重播「" + block.name + "」"}>
        <Play size={14} /> 重播
      </button>
    </div>
  );
}

export default function AnimationLibrary({ open, onClose, onInsert, where }) {
  const [group, setGroup] = useState("");
  const list = BLOCK_CATALOG.filter((b) => !group || b.group === group);
  return (
    <Modal open={open} onClose={onClose} wide title="動畫庫" description={`挑一個有動態效果的元件放到這一頁（${where}）。插入後，文字和項目都可以在左邊直接改；手機上會自動調整排版，系統設定「減少動態效果」的人看到的是靜態版。`}>
      <div className="lib-chips anim-groups">
        {["", ...BLOCK_GROUPS].map((g) => (
          <button key={g || "all"} type="button" className={group === g ? "active" : ""} onClick={() => setGroup(g)}>
            {g || "全部"}
          </button>
        ))}
      </div>
      <ul className="anim-grid">
        {list.map((b) => (
          <li key={b.id} className="anim-card">
            {open && <Preview block={b} />}
            <div className="anim-info">
              <strong>{b.name}</strong> <span className="muted">{b.en}</span>
              <p>{b.note}</p>
              <Button
                size="2"
                onClick={() => {
                  onInsert(b.id);
                  onClose();
                }}
              >
                <Plus size={14} /> 插入
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
