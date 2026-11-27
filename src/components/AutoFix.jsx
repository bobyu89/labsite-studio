// 一鍵修正: what the 設計規範 checks found that has one right answer, fixed
// together after one look at before → after. Text fixes are page edits
// (undo works page by page); photos are replaced by a new file on every page
// that shows them; nothing is published.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { MagicWand, Check } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { formatBytes } from "../site/images.js";

const name = (path) => path.split("/").pop();

export default function AutoFix({ p, open, onClose }) {
  const [plan, setPlan] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPlan(null);
    setDone(null);
    setError(null);
    p.autoFix
      .plan()
      .then((r) => {
        if (!alive) return;
        setPlan(r);
        setPick({ typeset: r.typeset.length > 0, pdf: r.pdf.length > 0, big: r.big.length > 0, members: !!r.members, alt: false });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sum = (list) => list.reduce((n, x) => n + x.count, 0);
  const aiOn = !!p.ai?.available;
  const altCount = Math.min(plan?.noAlt.length || 0, 10);
  const items = plan
    ? [
        plan.typeset.length > 0 && {
          id: "typeset",
          title: `中英文間距與全形標點：${sum(plan.typeset)} 處`,
          rule: "T-05",
          note: `${plan.typeset.length} 頁。中文和英文、數字之間加空格，中文裡的半形標點改成全形；日期（2026年11月）不動。`,
          examples: plan.typeset.flatMap((x) => x.examples).slice(0, 3),
        },
        plan.pdf.length > 0 && {
          id: "pdf",
          title: `連到 PDF 的連結標上格式和大小：${sum(plan.pdf)} 個`,
          rule: "I-02",
          note: "讀者點之前就知道會下載一個檔案、有多大。",
          examples: plan.pdf.flatMap((x) => x.examples).slice(0, 3),
        },
        plan.big.length > 0 && {
          id: "big",
          title: `太大的照片縮小：${plan.big.length} 張（共 ${formatBytes(plan.big.reduce((n, x) => n + x.size, 0))}）`,
          rule: "R-05",
          note: "縮到最長邊 1600 像素並重新壓縮，網頁和手機開得比較快。原本的檔案留在版本紀錄裡。",
          list: plan.big.map((x) => `${name(x.path)}（${formatBytes(x.size)}）`),
        },
        plan.members && {
          id: "members",
          title: `成員照片裁成同一個形狀：${plan.members.photos.length} 張改成${plan.members.shape.name}`,
          rule: "S-05",
          note: "大部分成員照片是這個形狀；其他的從中間裁切，直的照片會多留上方（頭部）。裁完請在預覽看一下。",
          list: plan.members.photos.map((x) => `${name(x.path)}（${x.w}×${x.h}）`),
        },
        plan.noAlt.length > 0 && {
          id: "alt",
          title: `照片沒有替代文字：${plan.noAlt.length} 張`,
          rule: "I-03",
          note: aiOn
            ? `請 AI 看照片寫一句說明${plan.noAlt.length > 10 ? "（一次最多 10 張）" : ""}，會用掉 ${altCount} 次 AI 次數。英文頁會用英文。`
            : "這個網站沒有開啟 AI，請在預覽點照片，自己填「替代文字」。",
          list: plan.noAlt.slice(0, 10).map((x) => name(x.path)),
          disabled: !aiOn,
        },
      ].filter(Boolean)
    : [];

  async function run() {
    setError(null);
    const log = [];
    try {
      if (pick.typeset) {
        setBusy("正在修正中英文間距與標點…");
        await p.autoFix.typeset(plan.typeset.map((x) => x.page));
        log.push(`中英文間距與標點 ${sum(plan.typeset)} 處`);
      }
      if (pick.pdf) {
        setBusy("正在標示 PDF 連結…");
        await p.autoFix.pdf(plan.pdf.map((x) => x.page), plan.sizes);
        log.push(`PDF 連結 ${sum(plan.pdf)} 個`);
      }
      if (pick.big) {
        let before = 0;
        let after = 0;
        for (const [i, x] of plan.big.entries()) {
          setBusy(`正在縮小照片（${i + 1}/${plan.big.length}）…`);
          const img = await p.autoFix.shrink(x.path, x.pages);
          if (img) {
            before += x.size;
            after += img.after;
          }
        }
        log.push(after ? `照片從 ${formatBytes(before)} 縮成 ${formatBytes(after)}` : "照片已經是最小，不用縮");
      }
      if (pick.members) {
        for (const [i, x] of plan.members.photos.entries()) {
          setBusy(`正在裁切成員照片（${i + 1}/${plan.members.photos.length}）…`);
          await p.autoFix.crop(x.path, plan.members.shape.ratio, x.pages);
        }
        log.push(`成員照片 ${plan.members.photos.length} 張裁成${plan.members.shape.name}`);
      }
      if (pick.alt) {
        let n = 0;
        for (const [i, x] of plan.noAlt.slice(0, 10).entries()) {
          setBusy(`AI 正在看照片寫替代文字（${i + 1}/${altCount}）…`);
          try {
            await p.autoFix.alt(x.path, x.pages);
            n++;
          } catch (e) {
            log.push(`替代文字停在第 ${i + 1} 張：${e.message}`);
            break;
          }
        }
        if (n) log.push(`替代文字 ${n} 張`);
      }
      setDone(log);
    } catch (e) {
      setError(e.message);
      if (log.length) setDone(log);
    } finally {
      setBusy(null);
    }
  }

  const any = items.some((x) => pick[x.id] && !x.disabled);
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="一鍵修正" description="設計規範裡有標準答案的問題，平台直接幫你改。先看改了什麼，再按修正；改完只是草稿，要發布才會上線。" wide>
      {!plan && !error && <p className="muted">正在看整個網站…</p>}
      {error && <p className="small-note error-text">{error}</p>}
      {plan && done && (
        <div className="autofix-done">
          <p>
            <Check size={18} weight="bold" /> 修正好了：{done.join("、")}。
          </p>
          <p className="small-note">在預覽看一下，沒問題再按「發布」。文字的修改可以在每一頁按「復原」；照片換回原本的，請到「版本紀錄」。</p>
          <Button onClick={onClose}>完成</Button>
        </div>
      )}
      {plan && !done && (
        <div className="autofix">
          {items.length === 0 && <p>沒有可以自動修正的地方。其他建議請看「網站體檢」。</p>}
          {items.map((x) => (
            <label key={x.id} className={"autofix-item" + (x.disabled ? " off" : "")}>
              <input type="checkbox" checked={!!pick[x.id] && !x.disabled} disabled={x.disabled || !!busy} onChange={(e) => setPick((k) => ({ ...k, [x.id]: e.target.checked }))} />
              <div>
                <strong>
                  {x.title}
                  <code className="rule-id">{x.rule}</code>
                </strong>
                <span className="small-note">{x.note}</span>
                {x.examples?.length > 0 && (
                  <ul className="autofix-examples">
                    {x.examples.map((e, i) => (
                      <li key={i}>
                        <del>{e.before}</del>
                        <span aria-hidden="true">→</span>
                        <ins>{e.after}</ins>
                      </li>
                    ))}
                  </ul>
                )}
                {x.list?.length > 0 && <p className="autofix-list">{x.list.slice(0, 8).join("、") + (x.list.length > 8 ? ` 等 ${x.list.length} 張` : "")}</p>}
              </div>
            </label>
          ))}
          {items.length > 0 && (
            <div className="autofix-actions">
              <Button size="3" color="orange" disabled={!any || !!busy} onClick={run}>
                <MagicWand size={18} /> {busy || "修正勾選的項目"}
              </Button>
              <span className="small-note">不會發布；改完先在預覽確認。</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
