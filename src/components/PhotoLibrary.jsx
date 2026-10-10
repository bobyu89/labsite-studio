import React, { useEffect, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import { Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { formatBytes, PICKER_ACCEPT } from "../site/images.js";

// Every image under assets/: pick one for an image field, upload a new one,
// or delete the ones no page uses any more (as one saved version).
export default function PhotoLibrary({ p, open, onClose, target, setConfirm }) {
  const [items, setItems] = useState(null);
  const [urls, setUrls] = useState({});
  const [chosen, setChosen] = useState(new Set());
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const list = await p.listAssets();
      setItems(list || []);
      const next = {};
      await Promise.all(
        (list || []).map(async (it) => {
          try {
            next[it.path] = URL.createObjectURL(await p.readAsset(it.path));
          } catch {
            /* unreadable: no thumbnail */
          }
        }),
      );
      setUrls((old) => {
        Object.values(old).forEach((u) => URL.revokeObjectURL(u));
        return next;
      });
    } catch (e) {
      setError("讀不到照片清單：" + e.message);
    }
  }
  useEffect(() => {
    if (open) {
      setChosen(new Set());
      setItems(null);
      load();
    }
    return () => {};
  }, [open]);
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), []);

  const unused = (items || []).filter((it) => !it.used && !it.pending);
  const toggle = (path) =>
    setChosen((s) => {
      const n = new Set(s);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="照片庫"
      description={
        target
          ? "選一張網站已有的圖片放進這個欄位，或上傳新的。上傳的照片會自動縮小並轉成 WebP。"
          : "網站 assets/ 裡的所有圖片。沒有任何頁面使用的圖片可以刪除。"
      }
    >
      {error && (
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      <div className="library-toolbar">
        {target && (
          <label className="upload-inline">
            <input
              type="file"
              accept={PICKER_ACCEPT}
              hidden
              onChange={async (e) => {
                const file = e.target.files[0];
                e.target.value = "";
                if (file && (await p.replaceImage(target.index, target.path, file))) onClose();
              }}
            />
            <Button asChild size="2">
              <span>
                <UploadSimple size={16} /> 上傳新圖片
              </span>
            </Button>
          </label>
        )}
        {!target && unused.length > 0 && (
          <Button
            size="2"
            variant="surface"
            color="red"
            disabled={!chosen.size || p.busy}
            onClick={() =>
              setConfirm({
                title: `刪除 ${chosen.size} 張圖片？`,
                description: "這些圖片沒有任何頁面使用。刪除會存成一個版本，之後可以在版本紀錄還原。",
                confirmLabel: "刪除",
                action: async () => {
                  if (await p.deleteAssets([...chosen])) load();
                  setChosen(new Set());
                },
              })
            }
          >
            <Trash size={16} /> 刪除選取的未使用圖片（{chosen.size}）
          </Button>
        )}
        {items && <span className="small-note">共 {items.length} 張，{unused.length} 張沒有使用。</span>}
      </div>
      {items === null ? (
        <p className="small-note">讀取中…</p>
      ) : items.length === 0 ? (
        <p className="small-note">網站的 assets/ 還沒有圖片。</p>
      ) : (
        <ul className="photo-library">
          {items.map((it) => (
            <li key={it.path} className={"photo-tile" + (chosen.has(it.path) ? " chosen" : "")}>
              <div className="photo-thumb">{urls[it.path] ? <img src={urls[it.path]} alt="" /> : <span>無法預覽</span>}</div>
              <div className="photo-meta">
                <code title={it.path}>{it.path.replace(/^assets\//, "")}</code>
                <span>
                  {formatBytes(it.size)}{" "}
                  <Badge size="1" variant="soft" color={it.pending ? "amber" : it.used ? "teal" : "gray"}>
                    {it.pending ? "尚未保存" : it.used ? "使用中" : "未使用"}
                  </Badge>
                </span>
              </div>
              {target ? (
                <Button
                  size="1"
                  onClick={() => {
                    p.useAsset(target.index, target.path, it.path);
                    onClose();
                  }}
                >
                  使用這張
                </Button>
              ) : (
                !it.used && !it.pending && (
                  <label className="check-row">
                    <input type="checkbox" checked={chosen.has(it.path)} onChange={() => toggle(it.path)} /> 選取
                  </label>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
