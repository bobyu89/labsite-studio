// 網站搬家: replace old addresses (e.g. the GitHub Pages one) with the new
// public address in every file of the site, as one saved version.
import React, { useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { ArrowRight, MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import { githubAddresses } from "../site/relocate.js";

export default function RelocatePanel({ p, writable, setConfirm }) {
  // Suggestions: this site's own old address first, then the other sites'
  // (their old addresses appear here as links between the labs).
  const suggested = useMemo(() => {
    const all = githubAddresses(p.cloud?.me?.sites || []);
    const own = p.cloudSite?.id;
    const ownName = p.cloudSite?.name;
    return all.sort((a, b) => (b.name === ownName) - (a.name === ownName)).map((x) => ({ ...x, on: true, own: x.name === ownName && !!own }));
  }, [p.cloud?.me, p.cloudSite?.id]);
  const [pairs, setPairs] = useState(suggested.length ? suggested : [{ from: "", to: p.cloudSite?.url || "", on: true }]);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const active = pairs.filter((x) => x.on && x.from.trim() && x.to.trim() && x.from.trim() !== x.to.trim()).map((x) => ({ from: x.from.trim(), to: x.to.trim() }));
  const blocked = !writable || p.busy || busy || p.anyDirty;
  const update = (i, patch) => {
    setPlan(null);
    setPairs((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const check = async () => {
    setBusy(true);
    try {
      setPlan(await p.planAddresses(active));
    } catch (e) {
      p.setError("檢查失敗：" + e.message);
    } finally {
      setBusy(false);
    }
  };
  const total = plan ? plan.reduce((n, f) => n + f.count, 0) : 0;
  return (
    <div className="relocate">
      <h3 className="inspector-subtitle">網站搬家：換掉舊網址</h3>
      <p className="small-note">
        把頁面、sitemap.xml、robots.txt、分享圖片與友站連結裡的舊網址，一次換成新網址，存成一個版本。
        {p.cloudSite?.url && <> 這個網站現在的網址是 <code>{p.cloudSite.url}</code>。</>}
      </p>
      {p.anyDirty && <p className="small-note warn-note">請先保存或還原目前的修改，再更換網址。</p>}
      <ol className="relocate-pairs">
        {pairs.map((x, i) => (
          <li key={i}>
            <label className="relocate-on">
              <input type="checkbox" checked={x.on} onChange={(e) => update(i, { on: e.target.checked })} />
              {x.name ? (x.own ? "本站" : x.name) : "自訂"}
            </label>
            <input aria-label="舊網址" placeholder="舊網址" value={x.from} onChange={(e) => update(i, { from: e.target.value })} />
            <ArrowRight size={14} aria-hidden="true" />
            <input aria-label="新網址" placeholder="新網址" value={x.to} onChange={(e) => update(i, { to: e.target.value })} />
            <button
              type="button"
              className="icon-button danger"
              aria-label="移除這一組"
              onClick={() => {
                setPlan(null);
                setPairs((ps) => ps.filter((_, j) => j !== i));
              }}
            >
              <Trash size={14} />
            </button>
          </li>
        ))}
      </ol>
      <div className="album-actions">
        <Button variant="ghost" size="1" onClick={() => setPairs((ps) => [...ps, { from: "", to: "", on: true }])}>
          <Plus size={14} /> 加一組
        </Button>
      </div>
      <div className="album-actions">
        <Button variant="surface" onClick={check} disabled={!active.length || busy || p.busy}>
          <MagnifyingGlass size={16} /> {busy ? "檢查中…" : "先檢查會改哪些地方"}
        </Button>
        <Button
          disabled={!active.length || blocked || !plan?.length}
          onClick={() =>
            setConfirm({
              title: `更換 ${total} 處網址？`,
              description: `會修改 ${plan.length} 個檔案並存成一個版本；按「發布」後網站才會更新。之後仍可在「版本紀錄」還原。`,
              confirmLabel: "更換並保存",
              action: async () => {
                const done = await p.replaceAddresses(active);
                if (done) setPlan(null);
              },
            })
          }
        >
          全部更換並保存
        </Button>
      </div>
      {plan && (
        <div className="relocate-plan">
          {plan.length === 0 ? (
            <p className="small-note">沒有找到這些舊網址，不需要更換。</p>
          ) : (
            <>
              <p className="small-note">
                會修改 {plan.length} 個檔案、共 {total} 處：
              </p>
              <ul>
                {plan.map((f) => (
                  <li key={f.path}>
                    <code>{f.path}</code> <span className="muted">{f.count} 處</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
