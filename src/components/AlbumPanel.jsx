// The site's activity album (LOCAL_PHOTOS in js/data.js): add several photos
// at once, write a caption for each, reorder, remove, save.
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { ImagesSquare, ArrowUp, ArrowDown, Trash, FloppyDisk, UploadSimple, ArrowSquareOut, Sparkle } from "@phosphor-icons/react";
import { PICKER_ACCEPT } from "../site/images.js";
import { useDragReorder } from "../hooks/useDragReorder";
import AiSuggest from "./AiSuggest";

export function Thumb({ p, src }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    const raw = p.readStaged(src);
    // Generated SVGs (素材庫) are staged as text.
    const staged = typeof raw === "string" ? new Blob([raw], { type: "image/svg+xml" }) : raw;
    (staged ? Promise.resolve(staged) : /^https?:/.test(src) ? Promise.resolve(null) : p.readAsset(src))
      .then((blob) => {
        if (!alive) return;
        if (blob) setUrl((made = URL.createObjectURL(blob)));
        else if (/^https?:/.test(src)) setUrl(src);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [src]);
  return <div className="album-thumb">{url ? <img src={url} alt="" /> : <ImagesSquare size={28} />}</div>;
}

export default function AlbumPanel({ p, writable, galleryPage, openPage, setConfirm }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const photos = p.album.photos;
  const accepts = writable && !p.busy;
  const drive = /DRIVE_API_KEY\s*:\s*"[^"]+"/.test(p.siteData?.text || "");
  const add = (list) => {
    const files = [...(list || [])];
    if (files.length) p.addAlbumPhotos(files);
  };
  const update = (i, patch) => p.setAlbumPhotos(photos.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const reorder = (from, to) => {
    const next = photos.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    p.setAlbumPhotos(next);
  };
  const move = (i, d) => reorder(i, i + d);
  const listRef = useRef(null);
  const { start, rowClass } = useDragReorder(listRef, reorder, { hold: true });
  // AI 幫沒有說明的照片寫說明: one request per photo, one after another; the
  // captions land in the fields to be read over before 保存相簿.
  const [batch, setBatch] = useState(null); // { done, total, error?, filled? }
  // Still without words: empty, or only the date a new photo gets (kept in
  // front, since captions starting with a date sort the album).
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const blank = photos.map((x, i) => [x, i]).filter(([x]) => !String(x.caption || "").trim() || DATE_ONLY.test(String(x.caption).trim()));
  const describeAll = async () => {
    const todo = blank.slice(0, 20);
    let filled = 0;
    let current = photos;
    setBatch({ done: 0, total: todo.length });
    for (const [photo, i] of todo) {
      try {
        const r = await p.ai.describePhoto(photo.src, { note: "" });
        if (r?.caption) {
          const date = String(photo.caption || "").trim();
          current = current.map((x, j) => (j === i ? { ...x, caption: (DATE_ONLY.test(date) ? date + " " : "") + r.caption } : x));
          p.setAlbumPhotos(current);
          filled++;
        }
      } catch (e) {
        setBatch({ done: filled, total: todo.length, error: e.message, filled });
        return;
      }
      setBatch({ done: filled, total: todo.length });
    }
    setBatch({ done: filled, total: todo.length, filled });
  };
  return (
    <div className="album-panel">
      <p className="small-note">
        這裡的照片會出現在「活動花絮」頁，說明文字會顯示在照片下方。說明開頭寫日期（例如 2026-06-15）會依日期排序。
      </p>
      {drive && (
        <p className="small-note warn-note">這個網站也設定了 Google 雲端硬碟相簿；雲端讀得到照片時，會優先顯示雲端的照片。</p>
      )}
      <div
        className={"album-drop" + (over ? " drop-over" : "")}
        onDragOver={(e) => {
          if (!accepts || ![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (!accepts) return;
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
      >
        <UploadSimple size={26} />
        <strong>把照片拖到這裡</strong>
        <span>可以一次放很多張，會自動縮小</span>
        <input
          ref={input}
          type="file"
          accept={PICKER_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <Button size="2" onClick={() => input.current?.click()} disabled={!accepts}>
          選擇照片
        </Button>
      </div>
      <div className="album-actions">
        <Button onClick={p.saveSiteData} disabled={!p.siteDirty || !writable || p.busy}>
          <FloppyDisk size={16} /> {p.busy ? "處理中" : "保存相簿"}
        </Button>
        {p.ai?.available && writable && blank.length > 0 && (
          <Button
            variant="soft"
            color="orange"
            disabled={p.busy || (batch && batch.filled === undefined && !batch.error)}
            onClick={() =>
              setConfirm({
                title: `請 AI 幫 ${Math.min(blank.length, 20)} 張照片寫說明？`,
                description: `只寫還沒有說明（或只有日期）的照片${blank.length > 20 ? "（一次最多 20 張）" : ""}，每張用掉今天的 1 次 AI 次數。寫好會填在說明欄，請看過、改好再按「保存相簿」。AI 不會猜人名和日期，需要時請自己補上。`,
                confirmLabel: "開始",
                action: describeAll,
              })
            }
          >
            <Sparkle size={16} /> AI 幫沒有說明的照片寫說明（{blank.length} 張）
          </Button>
        )}
        {galleryPage && (
          <Button variant="soft" onClick={() => openPage(galleryPage)}>
            <ArrowSquareOut size={16} /> 預覽活動花絮頁
          </Button>
        )}
      </div>
      {batch && (
        <p className={"small-note" + (batch.error ? " error-text" : "")} role="status">
          {batch.error
            ? `寫到第 ${batch.done + 1} 張時停下來了：${batch.error}`
            : batch.filled === undefined
              ? `AI 正在看照片…（${batch.done}／${batch.total}）`
              : `已幫 ${batch.filled} 張照片寫好說明，請看過再按「保存相簿」。`}
        </p>
      )}
      {photos.length === 0 ? (
        <p className="small-note">相簿還是空的；網站目前顯示的是範例圖。加入第一張照片後，範例圖就會換成你的照片。</p>
      ) : (
        <ol className="album-list" ref={listRef} data-list>
          {photos.length > 1 && writable && <li className="album-hint small-note">按住照片拖曳就能調整順序（手機上先按住一下再移動）。</li>}
          {photos.map((photo, i) => (
            <li key={photo.src + i} data-row className={rowClass(i, photos.length)}>
              <div
                className={"ca-drag" + (writable ? "" : " off")}
                title={writable ? "按住拖曳可以調整順序" : undefined}
                onPointerDown={writable ? (e) => start(e, i) : undefined}
              >
                <Thumb p={p} src={photo.thumb || photo.src} />
              </div>
              <div className="album-fields">
                <label className="field">
                  <span>照片說明</span>
                  <input value={photo.caption} onChange={(e) => update(i, { caption: e.target.value })} disabled={!writable} />
                </label>
                {p.ai?.available && writable && (
                  <AiSuggest
                    label="AI 看照片寫說明"
                    disabled={p.busy}
                    ask={() => p.ai.describePhoto(photo.src, { note: photo.caption })}
                    pickText={(r) => r.caption}
                    onApply={(caption) => update(i, { caption })}
                  />
                )}
                <div className="album-row-actions">
                  <button type="button" className="icon-button" aria-label="往前移" disabled={!writable || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="icon-button" aria-label="往後移" disabled={!writable || i === photos.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="從相簿移除"
                    disabled={!writable}
                    onClick={() =>
                      setConfirm({
                        title: "從相簿移除這張照片？",
                        description: "照片會從活動花絮頁拿掉（照片檔本身留在照片庫，之後可以刪除）。可用「版本紀錄」找回。",
                        confirmLabel: "移除",
                        action: () => p.setAlbumPhotos(photos.filter((_, j) => j !== i)),
                      })
                    }
                  >
                    <Trash size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
