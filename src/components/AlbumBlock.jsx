// 相簿展示: insert a block showing one album, and change which album / which
// layout an existing block shows.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Modal } from "./ui";
import { LAYOUTS } from "../site/albums.js";

const LAYOUT_NOTES = {
  grid: "整齊的正方形縮圖",
  carousel: "一張一張左右滑動",
  masonry: "保留原本長寬比，像照片牆",
};

function LayoutPicker({ value, onChange, disabled }) {
  return (
    <div className="layout-picker" role="radiogroup" aria-label="排法">
      {LAYOUTS.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? "active" : ""} disabled={disabled} onClick={() => onChange(id)}>
          <span className={"layout-icon " + id} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>{label}</strong>
          <span>{LAYOUT_NOTES[id]}</span>
        </button>
      ))}
    </div>
  );
}

export function InsertAlbumDialog({ p, open, onClose, onInsert, openManager }) {
  const albums = p.albums?.albums || [];
  const [album, setAlbum] = useState("");
  const [layout, setLayout] = useState("grid");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) {
      setAlbum(albums[0]?.id || "");
      setTitle(albums[0]?.name || "");
      setText("");
      setLayout("grid");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="插入相簿展示" description="選一本雲端相簿放到這一頁。之後在相簿加照片，網站上會自動跟著更新。">
      {albums.length === 0 ? (
        <div className="insert-empty">
          <p className="small-note">還沒有相簿。先建立一本相簿並放進照片。</p>
          <Button
            onClick={() => {
              onClose();
              openManager();
            }}
          >
            打開雲端相簿
          </Button>
        </div>
      ) : (
        <div className="insert-form">
          <label className="field">
            <span>相簿</span>
            <select
              value={album}
              onChange={(e) => {
                const next = albums.find((a) => a.id === e.target.value);
                if (!title || albums.some((a) => a.name === title)) setTitle(next?.name || "");
                setAlbum(e.target.value);
              }}
            >
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}（{a.photos.length} 張）
                </option>
              ))}
            </select>
          </label>
          <span className="field-label">排法</span>
          <LayoutPicker value={layout} onChange={setLayout} />
          <label className="field">
            <span>標題</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>說明文字（可留白，之後再改）</span>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {p.albumsDirty && <p className="small-note warn-note">相簿有修改還沒保存；記得到雲端相簿按「保存相簿」，網站上才看得到。</p>}
          <div className="dialog-actions">
            <Button variant="surface" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!album}
              onClick={() => {
                onInsert({ album, layout, title, text });
                onClose();
              }}
            >
              插入
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Shown above the fields when the selected section has an album block.
export function AlbumBlockSettings({ p, block, onChange, writable, openManager }) {
  const albums = p.albums?.albums || [];
  return (
    <div className="album-block-settings">
      <label className="field">
        <span>展示哪一本相簿</span>
        <select value={block.album} disabled={!writable} onChange={(e) => onChange("data-album", e.target.value)}>
          {!albums.some((a) => a.id === block.album) && <option value={block.album}>（找不到這本相簿）</option>}
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}（{a.photos.length} 張）
            </option>
          ))}
        </select>
      </label>
      <span className="field-label">排法</span>
      <LayoutPicker value={block.layout} disabled={!writable} onChange={(v) => onChange("data-layout", v)} />
      <Button size="1" variant="soft" onClick={openManager}>
        管理相簿照片
      </Button>
    </div>
  );
}
