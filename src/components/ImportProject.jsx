import React, { useState, useRef } from "react";
import { Button, Badge } from "@radix-ui/themes";
import { UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { parseProject } from "../domain/project";
export default function ImportProject({ open, onClose, onApply, onBackup }) {
  const input = useRef();
  const [candidate, setCandidate] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
  async function readFile(file) {
    if (!file) return;
    setError("");
    setCandidate(null);
    setBusy(true);
    try {
      if (file.size > 25000000) throw Error("檔案超過 25 MB，無法匯入。");
      const parsed = parseProject(await file.text());
      await Promise.all(
        parsed.assets.map(
          (a) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              image.onload = resolve;
              image.onerror = () =>
                reject(Error("備份含有無法讀取的圖片，尚未套用。"));
              image.src = a.src;
            }),
        ),
      );
      setCandidate(parsed);
      setName(file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    setCandidate(null);
    setError("");
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title="匯入草稿備份"
      description="支援初版與新版 JSON 備份。先檢查內容，再由你決定是否取代目前草稿。"
    >
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          readFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <div className="import-pick">
        <UploadSimple size={32} />
        <Button
          variant="surface"
          disabled={busy}
          onClick={() => input.current.click()}
        >
          {busy ? "正在檢查…" : "選擇 JSON 備份"}
        </Button>
        <p className="small-note">
          最多 25 MB；只讀取你選擇的檔案，不會傳送到外部服務。
        </p>
      </div>
      {error && (
        <div className="message error" role="alert">
          <WarningCircle size={19} />
          {error}
        </div>
      )}
      {candidate && (
        <section className="import-summary">
          <Badge>格式檢查通過</Badge>
          <h3>{candidate.name}</h3>
          <p>{name}</p>
          <dl>
            <div>
              <dt>頁面</dt>
              <dd>{candidate.pages.length}</dd>
            </div>
            <div>
              <dt>區塊</dt>
              <dd>
                {candidate.pages.reduce((n, p) => n + p.blocks.length, 0)}
              </dd>
            </div>
            <div>
              <dt>內容項目</dt>
              <dd>
                {Object.values(candidate.collections).reduce(
                  (n, a) => n + a.length,
                  0,
                )}
              </dd>
            </div>
            <div>
              <dt>圖片</dt>
              <dd>{candidate.assets.length}</dd>
            </div>
          </dl>
          <p className="small-note">
            套用會取代目前畫面的草稿，包含未保存修改；可以復原。既有版本紀錄仍保留，套用後需另外保存。
          </p>
        </section>
      )}
      <div className="dialog-actions">
        <Button variant="surface" onClick={onBackup}>
          先備份目前草稿
        </Button>
        <Button
          disabled={!candidate || busy}
          onClick={() => {
            onApply(candidate);
            close();
          }}
        >
          確認取代草稿
        </Button>
      </div>
    </Modal>
  );
}
