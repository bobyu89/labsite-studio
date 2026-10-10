// The site's activity album (LOCAL_PHOTOS in js/data.js): add several photos
// at once, write a caption for each, reorder, remove, save.
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { ImagesSquare, ArrowUp, ArrowDown, Trash, FloppyDisk, UploadSimple, ArrowSquareOut } from "@phosphor-icons/react";
import { PICKER_ACCEPT } from "../site/images.js";

function Thumb({ p, src }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    const staged = p.readStaged(src);
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
  const move = (i, d) => {
    const next = photos.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    p.setAlbumPhotos(next);
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
        {galleryPage && (
          <Button variant="soft" onClick={() => openPage(galleryPage)}>
            <ArrowSquareOut size={16} /> 預覽活動花絮頁
          </Button>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="small-note">相簿還是空的；網站目前顯示的是範例圖。加入第一張照片後，範例圖就會換成你的照片。</p>
      ) : (
        <ol className="album-list">
          {photos.map((photo, i) => (
            <li key={photo.src + i}>
              <Thumb p={p} src={photo.thumb || photo.src} />
              <div className="album-fields">
                <label className="field">
                  <span>照片說明</span>
                  <input value={photo.caption} onChange={(e) => update(i, { caption: e.target.value })} disabled={!writable} />
                </label>
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
