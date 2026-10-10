// The three steps of editing, shown the first time someone opens the editor
// (and again from 使用說明). Written for teachers, not for web people.
import React from "react";
import { Button } from "@radix-ui/themes";
import { CursorClick, PencilSimpleLine, RocketLaunch, X } from "@phosphor-icons/react";

const KEY = "labsite-guide-v1";
export function guideDismissed() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}
function remember() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    /* private mode: shows again next time */
  }
}

export default function EditorGuide({ onClose, isCloud, hasAlbum }) {
  const close = () => {
    remember();
    onClose();
  };
  return (
    <section className="editor-guide" aria-labelledby="editor-guide-title">
      <div className="editor-guide-head">
        <h2 id="editor-guide-title">怎麼修改網站</h2>
        <button className="icon-button" aria-label="關閉使用說明" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <ol className="editor-guide-steps">
        <li>
          <CursorClick size={26} />
          <strong>點選要改的地方</strong>
          <span>在右邊的網站預覽裡點一下文字或照片，左邊就會出現可以修改的欄位。要改別頁，用上方的「頁面」選單。</span>
        </li>
        <li>
          <PencilSimpleLine size={26} />
          <strong>改文字、換照片</strong>
          <span>
            直接在左邊改字。照片按「換一張照片」，或把電腦裡的照片拖到預覽的圖片上。成員照片：點成員的圓形頭像。
            {hasAlbum && " 活動照片：到「活動相簿」分頁一次加入很多張。"}
          </span>
        </li>
        <li>
          <RocketLaunch size={26} />
          <strong>{isCloud ? "保存，再發布" : "保存"}</strong>
          <span>
            {isCloud
              ? "「保存」會留下一個版本，只有編輯者看得到；按「發布」後，大家看到的網站才會更新。改錯了可以按復原，或到「版本紀錄」找回舊版。"
              : "「保存」會把修改寫回網站檔案。改錯了可以按復原。"}
          </span>
        </li>
      </ol>
      <div className="editor-guide-foot">
        <span className="small-note">之後可以按上方的「使用說明」再打開這張說明。</span>
        <Button size="2" onClick={close}>
          知道了，開始修改
        </Button>
      </div>
    </section>
  );
}
