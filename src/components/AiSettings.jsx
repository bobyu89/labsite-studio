// AI 助手設定 (admin): where the Anthropic API key goes, how many requests a
// site may make per day, and which sites have the assistant.
//
// The key is typed here and sent once to the server; afterwards the page only
// ever shows its last four characters.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { WarningCircle, CaretLeft } from "@phosphor-icons/react";
import BackupSettings from "./BackupSettings";

export default function AiSettings({ p, onBack, setConfirm }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [key, setKey] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { ok, text }

  const show = (v) => {
    setView(v);
    setLimit(String(v.dailyLimit));
  };
  useEffect(() => {
    let alive = true;
    p.cloudCalls
      .aiSettings()
      .then((v) => alive && show(v))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (work) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
    } catch (e) {
      setNote({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  const fromEnv = view?.source === "env";
  const test = (candidate) =>
    run(async () => {
      const r = await p.cloudCalls.testAiKey(candidate || undefined);
      setNote(r.ok ? { ok: true, text: `連線正常，金鑰結尾 …${r.last4}` } : { ok: false, text: r.error });
    });
  const saveKey = () =>
    run(async () => {
      const candidate = key.trim();
      // Check it works before storing it, so a mistyped key is caught here.
      const r = await p.cloudCalls.testAiKey(candidate);
      if (!r.ok) return setNote({ ok: false, text: r.error + " 金鑰沒有儲存。" });
      show(await p.cloudCalls.saveAiSettings({ key: candidate }));
      setKey("");
      setNote({ ok: true, text: `已儲存，連線正常。金鑰結尾 …${r.last4}` });
      p.refreshCloud();
    });
  const saveLimit = () =>
    run(async () => {
      show(await p.cloudCalls.saveAiSettings({ dailyLimit: Number(limit) }));
      setNote({ ok: true, text: "已更新每天的次數。" });
    });
  const toggle = (id, enabled) =>
    run(async () => {
      const off = view.sites.filter((s) => (s.id === id ? !enabled : !s.enabled)).map((s) => s.id);
      show(await p.cloudCalls.saveAiSettings({ off }));
      p.refreshCloud();
    });
  const remove = () =>
    setConfirm({
      title: "移除金鑰並關閉 AI 助手？",
      description: "所有網站的編輯畫面都不會再出現 AI 助手和 AI 外觀，其他功能照常使用。之後可以再放一把金鑰重新開啟。",
      confirmLabel: "移除金鑰",
      action: () =>
        run(async () => {
          show(await p.cloudCalls.removeAiKey());
          setNote({ ok: true, text: "金鑰已移除，AI 助手已關閉。" });
          p.refreshCloud();
        }),
    });

  return (
    <div className="ai-settings">
      <div className="page-heading compact home-heading">
        <div>
          <h1>平台設定</h1>
          <p>只有管理者看得到：AI 助手的金鑰與用量，以及網站備份到 GitHub 的設定。</p>
        </div>
        <Button variant="surface" color="gray" onClick={onBack}>
          <CaretLeft size={16} /> 我的網站
        </Button>
      </div>
      {error && (
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      {!view && !error && <p className="muted">正在讀取設定…</p>}
      {view && (
        <>
          <h2 className="settings-heading">AI 助手</h2>
          <div className="settings-card">
            <section>
              <h2>API 金鑰</h2>
              {fromEnv ? (
                <p className="small-note">
                  金鑰由 Cloudflare 的 <code>ANTHROPIC_API_KEY</code> 設定提供（結尾 …{view.last4}），要更換或移除請到 Cloudflare。
                </p>
              ) : (
                <>
                  <p className="settings-status">
                    {view.configured ? (
                      <>
                        目前使用的金鑰結尾是 <strong>…{view.last4}</strong>。要換一把，在下面貼上新的。
                      </>
                    ) : (
                      "還沒有金鑰，所以編輯畫面目前不會出現 AI 助手。"
                    )}
                  </p>
                  <label className="field">
                    <span>{view.configured ? "新的 API 金鑰" : "API 金鑰"}</span>
                    <input
                      type="password"
                      value={key}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="sk-ant-…"
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </label>
                  <p className="small-note">
                    在 Anthropic Console（
                    <a className="text-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                      console.anthropic.com
                    </a>
                    ）的 API Keys 建立，整串貼上。儲存後這裡只會顯示最後 4 碼。
                  </p>
                </>
              )}
              <div className="settings-actions">
                {!fromEnv && (
                  <Button color="orange" disabled={busy || key.trim().length < 20} onClick={saveKey}>
                    {busy ? "處理中" : "儲存"}
                  </Button>
                )}
                <Button variant="surface" color="gray" disabled={busy || (!view.configured && key.trim().length < 20)} onClick={() => test(key.trim())}>
                  測試連線
                </Button>
              </div>
              {note && (
                <p className={"settings-status " + (note.ok ? "settings-ok" : "error-text")} role="status">
                  {note.text}
                </p>
              )}
            </section>
            <section className="settings-split">
              <label className="field">
                <span>每個網站每天最多用幾次</span>
                <input type="number" min="1" max="500" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </label>
              <Button variant="surface" color="gray" disabled={busy || String(view.dailyLimit) === limit.trim() || !limit.trim()} onClick={saveLimit}>
                更新
              </Button>
              <p className="small-note">用完會顯示「今天的 AI 次數用完了」，隔天自動恢復。用來避免費用超出預期。</p>
            </section>
            <section>
              <h2>哪些網站可以用 AI 助手</h2>
              {view.sites.length === 0 && <p className="small-note">還沒有網站。</p>}
              {view.sites.map((s) => (
                <label key={s.id} className="settings-check">
                  <input type="checkbox" checked={s.enabled} disabled={busy} onChange={(e) => toggle(s.id, e.target.checked)} />
                  <span>{s.name}</span>
                  <span className="muted">今天用了 {s.today} 次</span>
                </label>
              ))}
            </section>
            <section className="settings-foot">
              <span>這個月已使用 {view.month} 次</span>
              {view.configured && !fromEnv && (
                <Button variant="surface" color="red" disabled={busy} onClick={remove}>
                  移除金鑰並關閉 AI 助手
                </Button>
              )}
            </section>
          </div>
          <h2 className="settings-heading">GitHub 備份</h2>
          <BackupSettings p={p} setConfirm={setConfirm} />
          <div className="settings-notes">
            <h2>金鑰怎麼保管</h2>
            <p>金鑰存在 LabSite 的資料庫（Cloudflare D1），只有伺服器在呼叫 AI 時會讀取。它不會傳到任何人的瀏覽器：老師看不到，你之後在這一頁也只看得到最後 4 碼。</p>
            <p>費用由這把金鑰所屬的 Anthropic 帳號支付。建議在 Anthropic Console 為這把金鑰設定每月花費上限。</p>
            <p>老師使用助手時，正在編輯的那一頁文字和他寫的要求會送到 Anthropic 的 AI 處理；助手只提出修改建議，要老師按「套用」才會改，也不會自己發布。</p>
            <p>沒有設定金鑰時，編輯畫面不會出現 AI 助手，其他功能照常使用。</p>
          </div>
        </>
      )}
    </div>
  );
}
