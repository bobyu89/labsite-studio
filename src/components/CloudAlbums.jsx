// 雲端相簿: the site's own small photo drive. Albums of photos (data/albums.json)
// plus every image the site has. Two modes:
//   manage — create albums, add many photos, captions, order, cover, move, delete
//   pick   — choose one photo for an image field, a photo block or the share image
import React, { useEffect, useRef, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  ArrowLeft,
  ArrowRight,
  FloppyDisk,
  FolderSimplePlus,
  Images,
  Star,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { Modal } from "./ui";
import { Thumb } from "./AlbumPanel";
import { formatBytes, PICKER_ACCEPT } from "../site/images.js";
import { newAlbumId, coverOf } from "../site/albums.js";

const ALL = "__all";
const ACTIVITY = "__activity";

function DropZone({ disabled, onFiles, children }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  return (
    <div
      className={"album-drop ca-drop" + (over ? " drop-over" : "")}
      onDragOver={(e) => {
        if (disabled || ![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (disabled) return;
        e.preventDefault();
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <UploadSimple size={22} />
      <span>{children}</span>
      <input
        ref={input}
        type="file"
        accept={PICKER_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onFiles([...e.target.files]);
          e.target.value = "";
        }}
      />
      <Button size="1" onClick={() => input.current?.click()} disabled={disabled}>
        選擇照片
      </Button>
    </div>
  );
}

// The photos of one album, editable (or pickable).
function PhotoGrid({ p, photos, onChange, pick, onPick, cover, onCover, moveTargets, onMove, writable }) {
  const swap = (i, d) => {
    const next = photos.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  if (!photos.length) return <p className="small-note">這本相簿還沒有照片。</p>;
  return (
    <ul className="ca-grid">
      {photos.map((ph, i) => (
        <li key={ph.src + i} className="ca-tile">
          {pick ? (
            <button type="button" className="ca-pick" onClick={() => onPick(ph.src)} aria-label={"使用「" + (ph.caption || ph.src) + "」"}>
              <Thumb p={p} src={ph.src} />
              <span>使用這張</span>
            </button>
          ) : (
            <Thumb p={p} src={ph.src} />
          )}
          {cover === ph.src && <span className="ca-cover">封面</span>}
          {!pick && (
            <>
              <input
                className="ca-caption"
                aria-label="照片說明"
                placeholder="照片說明"
                value={ph.caption}
                disabled={!writable}
                onChange={(e) => onChange(photos.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <div className="ca-actions">
                <button type="button" className="icon-button" aria-label="往前移" disabled={!writable || i === 0} onClick={() => swap(i, -1)}>
                  <ArrowLeft size={14} />
                </button>
                <button type="button" className="icon-button" aria-label="往後移" disabled={!writable || i === photos.length - 1} onClick={() => swap(i, 1)}>
                  <ArrowRight size={14} />
                </button>
                {onCover && (
                  <button type="button" className="icon-button" aria-label="設為封面" title="設為封面" disabled={!writable} onClick={() => onCover(ph.src)}>
                    <Star size={14} weight={cover === ph.src ? "fill" : "regular"} />
                  </button>
                )}
                {moveTargets?.length > 0 && (
                  <select
                    aria-label="移到其他相簿"
                    value=""
                    disabled={!writable}
                    onChange={(e) => e.target.value && onMove(i, e.target.value)}
                  >
                    <option value="">移到…</option>
                    {moveTargets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label="從相簿移除"
                  title="從相簿移除（照片檔仍留在「全部照片」）"
                  disabled={!writable}
                  onClick={() => onChange(photos.filter((_, j) => j !== i))}
                >
                  <Trash size={14} />
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// Every image of the site, which albums use it, and deleting unused ones.
function AllPhotos({ p, pick, onPick, albums, onAddTo, setConfirm, writable, open }) {
  const [items, setItems] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const load = async () => {
    try {
      setItems((await p.listAssets()) || []);
    } catch (e) {
      p.setError("讀不到照片清單：" + e.message);
      setItems([]);
    }
  };
  useEffect(() => {
    if (open) {
      setItems(null);
      setChosen(new Set());
      load();
    }
  }, [open]);
  const inAlbum = (path) => albums.filter((a) => a.photos.some((x) => x.src === path)).map((a) => a.name);
  const unused = (items || []).filter((it) => !it.used && !it.pending);
  if (items === null) return <p className="small-note">讀取中…</p>;
  if (!items.length) return <p className="small-note">網站還沒有任何照片。</p>;
  return (
    <>
      <div className="library-toolbar">
        <span className="small-note">
          共 {items.length} 張；{unused.length} 張沒有任何頁面或相簿使用{unused.length ? "，可以勾選刪除" : ""}。
        </span>
        {!pick && unused.length > 0 && (
          <Button
            size="1"
            variant="surface"
            color="red"
            disabled={!chosen.size || p.busy || !writable}
            onClick={() =>
              setConfirm({
                title: `刪除 ${chosen.size} 張照片？`,
                description: "這些照片沒有任何頁面或相簿使用。刪除會存成一個版本，之後可以在版本紀錄還原。",
                confirmLabel: "刪除",
                action: async () => {
                  if (await p.deleteAssets([...chosen])) load();
                  setChosen(new Set());
                },
              })
            }
          >
            <Trash size={14} /> 刪除勾選的（{chosen.size}）
          </Button>
        )}
      </div>
      <ul className="ca-grid">
        {items.map((it) => (
          <li key={it.path} className={"ca-tile" + (chosen.has(it.path) ? " chosen" : "")}>
            {pick ? (
              <button type="button" className="ca-pick" onClick={() => onPick(it.path)} aria-label={"使用 " + it.path}>
                <Thumb p={p} src={it.path} />
                <span>使用這張</span>
              </button>
            ) : (
              <Thumb p={p} src={it.path} />
            )}
            <div className="ca-meta">
              <code title={it.path}>{it.path.split("/").pop()}</code>
              <span>
                {formatBytes(it.size)}{" "}
                <Badge size="1" variant="soft" color={it.pending ? "amber" : it.used ? "teal" : "gray"}>
                  {it.pending ? "尚未保存" : it.used ? "使用中" : "未使用"}
                </Badge>
              </span>
              {inAlbum(it.path).length > 0 && <span className="muted">在：{inAlbum(it.path).join("、")}</span>}
            </div>
            {!pick && (
              <div className="ca-actions">
                {albums.length > 0 && (
                  <select aria-label="加到相簿" value="" disabled={!writable} onChange={(e) => e.target.value && onAddTo(e.target.value, it.path)}>
                    <option value="">加到相簿…</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {!it.used && !it.pending && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={chosen.has(it.path)}
                      onChange={() =>
                        setChosen((s) => {
                          const n = new Set(s);
                          n.has(it.path) ? n.delete(it.path) : n.add(it.path);
                          return n;
                        })
                      }
                    />{" "}
                    刪除
                  </label>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function CloudAlbums({ p, open, onClose, onPick, pickTitle, setConfirm }) {
  const pick = !!onPick;
  const albums = p.albums?.albums || [];
  const activity = p.album?.ok ? p.album.photos : null;
  const [view, setView] = useState(ALL);
  const writable = !!p.project?.source.writable;
  useEffect(() => {
    if (open && view !== ALL && view !== ACTIVITY && !albums.some((a) => a.id === view)) setView(albums[0]?.id || ALL);
  }, [open, albums.length]);
  const current = albums.find((a) => a.id === view);
  const update = (id, fn) => p.setAlbums((d) => ({ ...d, albums: d.albums.map((a) => (a.id === id ? fn(a) : a)) }));
  const addAlbum = () => {
    const id = newAlbumId(albums.map((a) => a.id));
    p.setAlbums((d) => ({ ...d, albums: [...d.albums, { id, name: "新相簿 " + (d.albums.length + 1), photos: [] }] }));
    setView(id);
  };
  const dirty = p.albumsDirty || p.siteDirty;
  const choose = (path) => {
    onPick(path);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={pick ? pickTitle || "從雲端相簿選照片" : "雲端相簿"}
      description={
        pick
          ? "點一張照片就會放進去。也可以先在相簿裡加入新照片，再選它。"
          : "網站自己的小雲端硬碟：照片分本放好，再用「相簿展示」或「單張照片」放到任何頁面。照片會自動縮小。"
      }
    >
      <div className="ca-layout">
        <nav className="ca-side" aria-label="相簿">
          <button type="button" className={view === ALL ? "active" : ""} onClick={() => setView(ALL)}>
            <Images size={16} /> 全部照片
          </button>
          {activity && (
            <button type="button" className={view === ACTIVITY ? "active" : ""} onClick={() => setView(ACTIVITY)}>
              活動花絮頁 <span className="muted">{activity.length}</span>
            </button>
          )}
          <span className="ca-side-label">相簿</span>
          {albums.map((a) => (
            <button key={a.id} type="button" className={view === a.id ? "active" : ""} onClick={() => setView(a.id)}>
              {a.name} <span className="muted">{a.photos.length}</span>
            </button>
          ))}
          {!pick && (
            <button type="button" className="ca-new" onClick={addAlbum} disabled={!writable}>
              <FolderSimplePlus size={16} /> 新增相簿
            </button>
          )}
        </nav>
        <div className="ca-main">
          {view === ALL ? (
            <AllPhotos
              p={p}
              open={open}
              pick={pick}
              onPick={choose}
              albums={albums}
              writable={writable}
              setConfirm={setConfirm}
              onAddTo={(id, path) => update(id, (a) => (a.photos.some((x) => x.src === path) ? a : { ...a, photos: [...a.photos, { src: path, caption: "" }] }))}
            />
          ) : view === ACTIVITY && activity ? (
            <>
              <p className="small-note">這些照片顯示在網站原本的「活動花絮」頁（js/data.js）。</p>
              {!pick && (
                <DropZone disabled={!writable || p.busy} onFiles={(files) => p.addAlbumPhotos(files)}>
                  把照片拖到這裡，或
                </DropZone>
              )}
              <PhotoGrid p={p} photos={activity} onChange={p.setAlbumPhotos} pick={pick} onPick={choose} writable={writable} />
            </>
          ) : current ? (
            <>
              <div className="ca-head">
                <label className="field">
                  <span>相簿名稱</span>
                  <input
                    value={current.name}
                    disabled={!writable || pick}
                    onChange={(e) => update(current.id, (a) => ({ ...a, name: e.target.value.slice(0, 60) }))}
                  />
                </label>
                {!pick && (
                  <Button
                    size="1"
                    variant="ghost"
                    color="red"
                    disabled={!writable}
                    onClick={() =>
                      setConfirm({
                        title: `刪除相簿「${current.name}」？`,
                        description: "只刪除相簿本身；照片檔仍留在「全部照片」。頁面上展示這本相簿的區塊會變成空白。",
                        confirmLabel: "刪除相簿",
                        action: () => {
                          p.setAlbums((d) => ({ ...d, albums: d.albums.filter((a) => a.id !== current.id) }));
                          setView(ALL);
                        },
                      })
                    }
                  >
                    <Trash size={14} /> 刪除相簿
                  </Button>
                )}
              </div>
              <DropZone disabled={!writable || p.busy} onFiles={(files) => p.addPhotosToAlbum(current.id, files)}>
                把照片拖到這裡（可以一次很多張），或
              </DropZone>
              <PhotoGrid
                p={p}
                photos={current.photos}
                writable={writable}
                pick={pick}
                onPick={choose}
                onChange={(photos) => update(current.id, (a) => ({ ...a, photos }))}
                cover={coverOf(current)}
                onCover={(src) => update(current.id, (a) => ({ ...a, cover: src }))}
                moveTargets={albums.filter((a) => a.id !== current.id)}
                onMove={(i, to) => {
                  const photo = current.photos[i];
                  p.setAlbums((d) => ({
                    ...d,
                    albums: d.albums.map((a) =>
                      a.id === current.id
                        ? { ...a, photos: a.photos.filter((_, j) => j !== i) }
                        : a.id === to
                          ? { ...a, photos: [...a.photos, photo] }
                          : a,
                    ),
                  }));
                }}
              />
            </>
          ) : (
            <p className="small-note">還沒有相簿。按左邊「新增相簿」開始。</p>
          )}
        </div>
      </div>
      {p.error && (
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{p.error}</span>
          <button onClick={() => p.setError(null)}>關閉</button>
        </div>
      )}
      <div className="ca-foot">
        <span className={"small-note" + (dirty ? " warn-note" : "")}>{dirty ? "相簿有修改還沒保存。" : "相簿已保存。"}</span>
        <Button onClick={p.saveAlbums} disabled={!dirty || !writable || p.busy}>
          <FloppyDisk size={16} /> {p.busy ? "處理中" : "保存相簿"}
        </Button>
      </div>
    </Modal>
  );
}
