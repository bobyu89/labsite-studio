// 學期更新精靈: one screen for what changes every semester on the members
// page — who graduated (moved to 畢業成員, or off the list), whose year goes
// up, and who joins. The English page gets the same moves when its lists
// line up; new wording there is left for 中英不同步 to point out.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Modal } from "./ui";
import { parsePage, pairOf } from "../site/page.js";
import { memberLists, bumpYear, degreeOf, applySemester, parseNewMembers } from "../site/semester.js";

const THIS_YEAR = new Date().getFullYear();

export default function SemesterWizard({ p, open, onClose, page, onDone, askAi }) {
  const [lists, setLists] = useState(null);
  const [grad, setGrad] = useState({}); // "list:index" → { values }
  const [roles, setRoles] = useState({}); // "list:index" → new role
  const [newText, setNewText] = useState("");
  const enPage = page ? pairOf(page, p.pages) : null;

  useEffect(() => {
    if (!open || !page) return;
    let alive = true;
    setLists(null);
    setGrad({});
    setNewText("");
    (async () => {
      const html = await p.ensureLoaded(page);
      const found = html ? memberLists(parsePage(html).doc) : { current: [], alumni: null };
      if (!alive) return;
      setLists(found);
      const r = {};
      found.current.forEach((l, li) => l.items.forEach((it) => (r[li + ":" + it.index] = bumpYear(it.role) ?? it.role)));
      setRoles(r);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page]);

  const toggle = (li, it) =>
    setGrad((g) => {
      const k = li + ":" + it.index;
      const n = { ...g };
      if (n[k]) delete n[k];
      else {
        const degree = degreeOf(it.role);
        n[k] = { values: [String(THIS_YEAR), it.name + (degree ? `（${degree}）` : ""), ""] };
      }
      return n;
    });
  const plan = useMemo(() => {
    if (!lists) return null;
    const graduates = [];
    const changedRoles = [];
    lists.current.forEach((l, li) =>
      l.items.forEach((it) => {
        const k = li + ":" + it.index;
        if (grad[k]) graduates.push({ list: li, index: it.index, values: grad[k].values });
        else if (roles[k] && roles[k] !== it.role) changedRoles.push({ list: li, index: it.index, value: roles[k] });
      }),
    );
    return { graduates, roles: changedRoles };
  }, [lists, grad, roles]);
  const newcomers = parseNewMembers(newText);
  const useAi = p.ai?.available && newText.trim().length > 0 && (newText.length > 120 || newcomers.some((x) => !x.role));

  const apply = async () => {
    const zhPlan = { ...plan, add: useAi ? [] : newcomers.map((x) => ({ list: 0, ...x })) };
    p.editPage(page, (doc) => applySemester(doc, zhPlan));
    // The English page: the same moves when its lists match the Chinese ones.
    let mirrored = false;
    if (enPage) {
      const enHtml = await p.ensureLoaded(enPage);
      const en = enHtml ? memberLists(parsePage(enHtml).doc) : null;
      const same = en && en.current.length === lists.current.length && en.current.every((l, i) => l.items.length === lists.current[i].items.length);
      if (same) {
        const enPlan = {
          graduates: plan.graduates.map((g) => ({ ...g, values: [g.values[0], en.current[g.list].items[g.index].name, ""] })),
          roles: plan.roles.map((r) => ({ ...r, value: bumpYear(en.current[r.list].items[r.index].role) })).filter((r) => r.value),
          add: zhPlan.add,
        };
        p.editPage(enPage, (doc) => applySemester(doc, enPlan));
        mirrored = true;
      }
    }
    onDone({ graduates: plan.graduates.length, roles: plan.roles.length, added: zhPlan.add.length, mirrored });
    if (useAi)
      askAi(
        `學期更新：請把以下新成員加到「${lists.current[0]?.heading || "成員"}」清單，每人一筆。只用下面寫的資料，沒寫的欄位留白，不要自己編。\n${newText.trim()}`,
      );
  };

  const nothing = plan && !plan.graduates.length && !plan.roles.length && !newcomers.length;
  return (
    <Modal open={open} onClose={onClose} title="學期更新" description="畢業的人移到畢業成員、年級加一、加入新成員，一次做完。" wide>
      {!page ? (
        <p className="small-note">這個網站沒有成員頁。</p>
      ) : lists === null ? (
        <p className="muted">正在讀成員頁…</p>
      ) : !lists.current.length ? (
        <p className="small-note">成員頁上找不到成員清單，請直接在編輯畫面修改。</p>
      ) : (
        <div className="semester">
          {lists.current.map((l, li) => (
            <section key={li} className="semester-list">
              <h4>{l.heading || "成員"}</h4>
              <div className="semester-head">
                <span>畢業</span>
                <span>姓名</span>
                <span>新學期的身分（可以改）</span>
              </div>
              {l.items.map((it) => {
                const k = li + ":" + it.index;
                return (
                  <div key={k} className={"semester-row" + (grad[k] ? " leaving" : "")}>
                    <input type="checkbox" checked={!!grad[k]} onChange={() => toggle(li, it)} aria-label={it.name + " 畢業"} />
                    <span className="semester-name">{it.name}</span>
                    {grad[k] ? (
                      lists.alumni ? (
                        <span className="semester-alumni">
                          <input
                            value={grad[k].values[0]}
                            aria-label="畢業年份"
                            onChange={(e) => setGrad((g) => ({ ...g, [k]: { values: [e.target.value, g[k].values[1], g[k].values[2]] } }))}
                          />
                          <input
                            value={grad[k].values[1]}
                            aria-label="畢業成員顯示的名稱"
                            onChange={(e) => setGrad((g) => ({ ...g, [k]: { values: [g[k].values[0], e.target.value, g[k].values[2]] } }))}
                          />
                          <input
                            value={grad[k].values[2]}
                            placeholder="現職（可留白）"
                            aria-label="現職"
                            onChange={(e) => setGrad((g) => ({ ...g, [k]: { values: [g[k].values[0], g[k].values[1], e.target.value] } }))}
                          />
                        </span>
                      ) : (
                        <span className="small-note">會從名單移除</span>
                      )
                    ) : it.roleField ? (
                      <input value={roles[k] ?? ""} onChange={(e) => setRoles((r) => ({ ...r, [k]: e.target.value }))} className={roles[k] !== it.role ? "changed" : ""} aria-label={it.name + " 的身分"} />
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </section>
          ))}
          {!lists.alumni && Object.keys(grad).length > 0 && <p className="small-note">成員頁沒有「畢業成員」清單，畢業的人會直接從名單移除。</p>}
          <label className="field">
            <span>新加入的成員（每行一位：姓名、身分；也可以貼上履歷，讓 AI 整理）</span>
            <textarea rows={4} value={newText} onChange={(e) => setNewText(e.target.value)} placeholder={"林新生、碩士班一年級\n陳同學、研究助理"} />
          </label>
          {useAi && <p className="small-note">內容比較長，套用後會交給 AI 助手整理成成員資料，給你看過再加入。</p>}
          <p className="small-note">
            年級會自動加一（例如碩一 → 碩二），有標顏色的就是會改的；不對的可以直接改。
            {enPage ? "英文頁的清單一樣時，畢業和新成員會一起處理，英文的身分請之後確認（左邊會標「英文未更新」）。" : ""}
          </p>
          <div className="quick-add-actions">
            <Button size="3" disabled={nothing || p.busy} onClick={apply}>
              套用{plan ? `（${[plan.graduates.length && plan.graduates.length + " 人畢業", plan.roles.length && plan.roles.length + " 人更新身分", newcomers.length && !useAi && newcomers.length + " 人加入"].filter(Boolean).join("、") || "沒有變更"}）` : ""}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
