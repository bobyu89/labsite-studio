import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { YoutubeLogo, MapPin, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Modal, Field } from "./ui";
import { EMBED_KINDS, embedFromInput, embedLabel } from "../site/embeds.js";

// ＋ 影片／地圖: paste a YouTube link, a Google Maps link or the map's embed
// code, or type an address. The block is inserted after the selected section.
export default function EmbedDialog({ open, onClose, where, onInsert }) {
  const [kind, setKind] = useState("video");
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const result = useMemo(() => (input.trim() ? embedFromInput(input, kind) : null), [input, kind]);
  const close = () => {
    setInput("");
    setTitle("");
    onClose();
  };
  const insert = () => {
    if (!result?.ok) return;
    onInsert({ kind: result.kind, src: result.src, title: title.trim() || EMBED_KINDS[result.kind].title });
    close();
  };
  return (
    <Modal open={open} onClose={close} title="加入影片或地圖" description={where}>
      <div className="embed-kinds" role="radiogroup" aria-label="種類">
        {[
          ["video", <YoutubeLogo key="i" size={20} />, "YouTube 影片"],
          ["map", <MapPin key="i" size={20} />, "Google 地圖"],
        ].map(([id, icon, label]) => (
          <button key={id} type="button" role="radio" aria-checked={kind === id} className={"embed-kind" + (kind === id ? " active" : "")} onClick={() => setKind(id)}>
            {icon}
            {label}
          </button>
        ))}
      </div>
      <Field
        label={kind === "video" ? "影片網址" : "地圖網址、嵌入程式碼或地址"}
        value={input}
        area={kind === "map"}
        rows={kind === "map" ? 3 : undefined}
        onChange={setInput}
        placeholder={kind === "video" ? "https://www.youtube.com/watch?v=…" : "例如：國防醫學大學護理學院，或貼上 Google 地圖網址"}
        autoFocus
      />
      {result &&
        (result.ok ? (
          <p className="embed-check ok">
            <CheckCircle size={16} /> {result.kind === "video" ? "找到影片：" : "地圖會顯示："}
            <span>{embedLabel(result.src)}</span>
          </p>
        ) : (
          <p className="embed-check error">
            <WarningCircle size={16} /> {result.error}
          </p>
        ))}
      <Field label="區塊標題" value={title} onChange={setTitle} placeholder={EMBED_KINDS[kind].title} />
      <p className="small-note">
        {kind === "video"
          ? "影片用 YouTube 的隱私加強模式嵌入，訪客按下播放前不會被追蹤。"
          : "在 Google 地圖找到地點後，按「分享 › 嵌入地圖」複製的程式碼最準確；直接打地址也可以。"}
      </p>
      <div className="dialog-actions">
        <Button variant="soft" color="gray" onClick={close}>
          取消
        </Button>
        <Button disabled={!result?.ok} onClick={insert}>
          加入
        </Button>
      </div>
    </Modal>
  );
}
