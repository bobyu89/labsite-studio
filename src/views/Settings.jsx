import React from "react";
import { Button } from "@radix-ui/themes";
import {
  ArrowUpRight,
  DownloadSimple,
  UploadSimple,
  GithubLogo,
} from "@phosphor-icons/react";
import { Field, download } from "../components/ui";

export default function Settings({
  draft,
  change,
  save,
  saving,
  conflict,
  setConnection,
  exportBackup,
  doc,
  notify,
  requestImport,
}) {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>網站設定</h1>
          <p>管理網站識別與發布前需要完成的設定。</p>
        </div>
        <Button onClick={save} disabled={saving || conflict}>
          保存設定
        </Button>
      </div>
      <section className="settings-section">
        <div>
          <h2>基本資訊</h2>
          <p>顯示在網站導覽與頁尾。</p>
        </div>
        <div>
          <Field
            label="網站名稱"
            value={draft.name}
            onChange={(name) => change({ name })}
          />
          <Field
            label="英文名稱"
            value={draft.english}
            onChange={(english) => change({ english })}
          />
          <Field
            label="聯絡 Email"
            value={draft.email}
            type="email"
            onChange={(email) => change({ email })}
          />
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>GitHub 與發布</h2>
          <p>研究室保有網站的所有權。</p>
        </div>
        <div className="connection-box">
          <GithubLogo size={28} />
          <h3>尚未連接 GitHub</h3>
          <p>
            你可以繼續編輯與預覽。正式發布需完成帳號驗證、GitHub
            授權及網站設定。
          </p>
          <Button variant="surface" onClick={() => setConnection(true)}>
            查看連接需求 <ArrowUpRight size={17} />
          </Button>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>資料與備份</h2>
          <p>初版草稿儲存在此瀏覽器。</p>
        </div>
        <div>
          <p className="muted">
            清除瀏覽器資料會移除本機草稿。你可以下載備份，或匯出目前的網站。
          </p>
          <div className="button-row">
            <Button variant="surface" onClick={requestImport}>
              <UploadSimple size={17} />
              匯入草稿 JSON
            </Button>
            <Button variant="surface" onClick={exportBackup}>
              <DownloadSimple size={17} />
              下載草稿 JSON
            </Button>
            <Button
              variant="surface"
              onClick={() => {
                download(doc, "labsite-website.html", "text/html");
                notify("已匯出可直接開啟的網站 HTML，尚未發布到網路。");
              }}
            >
              匯出網站 HTML
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
