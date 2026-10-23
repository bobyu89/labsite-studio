import React, { useMemo, useRef, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  DotsSixVertical,
  CaretDown,
  CaretRight,
  Trash,
  ArrowSquareOut,
  EyeSlash,
  Plus,
  WarningCircle,
  FloppyDisk,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { IconButton, Field, Modal } from "./ui";
import { useDragReorder } from "../hooks/useDragReorder";
import { slugFor } from "../site/nav.js";

const key = (path) => path.join(".");

// 頁面與選單: the site's menu as an editable tree, plus adding and deleting
// pages. Menu edits are drafts; page additions and deletions save at once.
export default function PagesPanel({ p, writable, openPage, setConfirm }) {
  const nav = p.nav;
  const [open, setOpen] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const toggle = (k) =>
    setOpen((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  const groups = useMemo(
    () => (nav?.items || []).map((x, i) => [i, x]).filter(([, x]) => x.children),
    [nav],
  );
  const inMenu = useMemo(() => new Set((nav?.pages || []).map((x) => x.page)), [nav]);
  const outside = p.pages.filter((x) => !x.startsWith("en/") && !inMenu.has(x));

  if (!nav)
    return (
      <p className="small-note">
        這個網站沒有可以辨識的選單（<code>js/components.js</code> 的 <code>NAV_ITEMS</code>，或 <code>js/data.js</code> 的 <code>NAV</code>）。
      </p>
    );
  const askDelete = async (page) => {
    const links = await p.pageLinks(page);
    const name = p.labelOf(page);
    setConfirm({
      title: "刪除「" + name + "」？",
      description:
        "會刪除這一頁" +
        (p.pages.includes("en/" + page) ? "與英文版" : "") +
        "，並從選單與網站地圖移除，立即存成一個版本。" +
        (p.project.source.kind === "cloud" ? "按「發布」後才會從網站消失，之後仍可在「版本紀錄」還原。" : p.project.source.kind === "github" ? "會直接提交到 GitHub，網站一兩分鐘後更新。" : ""),
      body: links.length ? (
        <div className="message error" role="note">
          <WarningCircle size={18} />
          <span>這些頁面有連到它，刪除後連結會失效：{links.map((x) => p.labelOf(x.replace(/^en\//, "")) +(x.startsWith("en/") ? "（英文）" : "")).join("、")}</span>
        </div>
      ) : null,
      confirmLabel: "刪除頁面",
      action: () => p.deletePage(page),
    });
  };
  const blocked = p.anyDirty && !nav.dirty;
  return (
    <div className="pages-panel">
      <div className="pages-head">
        <p className="small-note">
          拖拉調整選單順序，點名稱可以改中英文名稱。保存選單時，頁面標題也會跟著改名。
        </p>
        <Button size="2" disabled={!writable || !nav.ok || p.busy || p.anyDirty} onClick={() => setCreating(true)}>
          <Plus size={16} /> 新增頁面
        </Button>
      </div>
      {!nav.ok && (
        <div className="message error" role="alert">
          <WarningCircle size={18} />
          <span>{nav.error}，選單只能看不能改。請先請工程協助把選單改成一般寫法。</span>
        </div>
      )}
      {p.anyDirty && (
        <div className="message" role="status">
          <WarningCircle size={18} />
          <span>{blocked ? "有其他還沒保存的修改" + (p.dirtyPages.length ? "（" + p.dirtyPages.map((x) => p.labelOf(x.replace(/^en\//, "")) + (x.startsWith("en/") ? "（英文）" : "")).join("、") + "）" : "") + "。新增或刪除頁面前，請先保存。" : "選單改了還沒保存。新增或刪除頁面前，請先保存選單。"}</span>
          {blocked && writable && (
            <Button size="1" disabled={p.busy} onClick={p.saveAll}>
              <FloppyDisk size={15} /> 全部保存
            </Button>
          )}
        </div>
      )}
      <MenuList
        p={p}
        items={nav.items}
        parent={null}
        groups={groups}
        open={open}
        toggle={toggle}
        writable={writable && nav.ok}
        openPage={openPage}
        askDelete={askDelete}
      />
      {nav.groups && writable && nav.ok && (
        <Button size="1" variant="soft" onClick={() => p.menu.addGroup({ zh: "新的下拉選單", en: "New menu" })}>
          <Plus size={14} /> 下拉選單
        </Button>
      )}
      {outside.length > 0 && (
        <div className="pages-outside">
          <h4>不在選單裡的頁面</h4>
          {outside.map((page) => (
            <div className="pages-outside-row" key={page}>
              <button type="button" className="text-link" onClick={() => openPage(page)}>
                {p.labelOf(page)} <code>{page}</code>
              </button>
              <span className="button-row">
                <Button size="1" variant="soft" disabled={!writable || !nav.ok} onClick={() => p.menu.addPage(page)}>
                  加入選單
                </Button>
                {page !== "index.html" && (
                  <IconButton label="刪除頁面" disabled={!writable || p.anyDirty || p.busy} onClick={() => askDelete(page)}>
                    <Trash size={15} />
                  </IconButton>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {nav.dirty && (
        <div className="pages-save">
          <Button disabled={!writable || p.busy} onClick={p.saveNav}>
            <FloppyDisk size={16} /> 保存選單
          </Button>
          <span className="small-note">選單改好了還沒保存。</span>
        </div>
      )}
      <NewPageDialog p={p} open={creating} onClose={() => setCreating(false)} groups={groups} />
    </div>
  );
}

function MenuList({ p, items, parent, groups, open, toggle, writable, openPage, askDelete }) {
  const listRef = useRef();
  const base = parent === null ? [] : [parent];
  const { start, rowClass } = useDragReorder(listRef, (from, to) => p.menu.move([...base, from], { parent, index: to }));
  if (!items.length && parent !== null) return <p className="small-note pages-empty">這個下拉選單還是空的，用「移到」把頁面放進來。</p>;
  return (
    <div className={"item-list menu-list" + (parent !== null ? " menu-children" : "")} data-list ref={listRef}>
      {items.map((item, i) => {
        const path = [...base, i];
        const k = key(path);
        const expanded = open.has(k);
        const kind = item.children ? "下拉選單" : item.page ? item.page : item.href ? "連結" : "";
        return (
          <div key={k} data-row className={"item-row" + (expanded ? " expanded" : "") + rowClass(i, items.length)}>
            <div className="item-row-head">
              {writable && (
                <button type="button" className="drag-handle" aria-label={"拖曳移動「" + item.zh + "」"} onPointerDown={(e) => start(e, i)}>
                  <DotsSixVertical size={16} weight="bold" />
                </button>
              )}
              <button type="button" className="item-pick" onClick={() => toggle(k)} aria-expanded={expanded}>
                {expanded ? <CaretDown size={13} /> : <CaretRight size={13} />}
                <span className="section-title">
                  {item.zh}
                  {item.en && item.en !== item.zh && <span className="menu-en">{item.en}</span>}
                </span>
                <Badge size="1" color="gray" variant="soft" className="menu-kind">
                  {kind}
                </Badge>
              </button>
              <span className="section-actions">
                {item.page && p.pages.includes(item.page) && (
                  <IconButton label="打開這一頁" onClick={() => openPage(item.page)}>
                    <ArrowSquareOut size={14} />
                  </IconButton>
                )}
                {writable && (
                  <IconButton
                    label={item.children ? "移除這個下拉選單" : "從選單移除（頁面保留）"}
                    disabled={!!item.children?.length}
                    onClick={() => p.menu.remove(path)}
                  >
                    <EyeSlash size={14} />
                  </IconButton>
                )}
                {writable && item.page && item.page !== "index.html" && p.pages.includes(item.page) && (
                  <IconButton label="刪除這一頁" disabled={p.anyDirty || p.busy} onClick={() => askDelete(item.page)}>
                    <Trash size={14} />
                  </IconButton>
                )}
              </span>
            </div>
            {expanded && (
              <div className="item-body">
                <Field label="中文名稱" value={item.zh} disabled={!writable} onChange={(zh) => p.menu.rename(path, { zh })} />
                <Field label="英文名稱" value={item.en} disabled={!writable} onChange={(en) => p.menu.rename(path, { en })} />
                {!item.children && groups.length > 0 && writable && (
                  <label className="page-picker">
                    <span>放在</span>
                    <select
                      value={parent === null ? "" : String(parent)}
                      onChange={(e) => {
                        const to = e.target.value === "" ? null : Number(e.target.value);
                        if (to === parent) return;
                        const target = to === null ? p.nav.items.length : p.nav.items[to].children.length;
                        p.menu.move(path, { parent: to, index: target });
                      }}
                    >
                      <option value="">選單最上層</option>
                      {groups.map(([gi, g]) => (
                        <option key={gi} value={String(gi)}>
                          「{g.zh}」下拉選單
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {item.href && !item.page && <p className="small-note">連到：{item.href}</p>}
                {item.children && (
                  <MenuList
                    p={p}
                    items={item.children}
                    parent={i}
                    groups={groups}
                    open={open}
                    toggle={toggle}
                    writable={writable}
                    openPage={openPage}
                    askDelete={askDelete}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewPageDialog({ p, open, onClose, groups }) {
  const zhPages = p.pages.filter((x) => !x.startsWith("en/"));
  const hasEn = p.pages.some((x) => x.startsWith("en/"));
  const defaultBase = !p.current || p.current.endsWith("index.html") ? zhPages.find((x) => x !== "index.html") || "index.html" : p.current.replace(/^en\//, "");
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [base, setBase] = useState(defaultBase);
  const [copy, setCopy] = useState(false);
  const [parent, setParent] = useState("");
  const slug = slugFor(en || zh, p.pages);
  const kind = p.project?.source.kind;
  const close = () => {
    setZh("");
    setEn("");
    setCopy(false);
    setParent("");
    onClose();
  };
  const create = async () => {
    const made = await p.createPage({ zh, en, base, blank: !copy, parent: parent === "" ? null : Number(parent) });
    if (made) close();
  };
  return (
    <Modal open={open} onClose={close} title="新增頁面" description="新頁面沿用網站的頁首、頁尾與樣式，建立後立刻放進選單。">
      <div className="new-page">
        <Field label="頁面名稱（中文）" value={zh} onChange={setZh} placeholder="例如：招生說明會" autoFocus />
        {hasEn && <Field label="英文名稱" value={en} onChange={setEn} placeholder="例如：Open Day（也會用在網址）" />}
        <label className="page-picker">
          <span>版面範本</span>
          <select value={base} onChange={(e) => setBase(e.target.value)}>
            {zhPages.map((x) => (
              <option key={x} value={x}>
                {p.labelOf(x)}　{x}
              </option>
            ))}
          </select>
        </label>
        <label className="check-line">
          <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
          <span>連範本頁的內容一起複製（不勾選：只留頁首，加一段「標題與文字」）</span>
        </label>
        {groups.length > 0 && (
          <label className="page-picker">
            <span>放在選單</span>
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">最上層（最後面）</option>
              {groups.map(([gi, g]) => (
                <option key={gi} value={String(gi)}>
                  「{g.zh}」下拉選單
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="small-note">
          網址：<code>{slug}.html</code>
          {hasEn && (
            <>
              、<code>en/{slug}.html</code>
            </>
          )}
          。建立後立刻存成一個版本
          {kind === "cloud" ? "，按「發布」後才會出現在網站上。" : kind === "github" ? "，會直接提交到 GitHub。" : "。"}
        </p>
      </div>
      <div className="dialog-actions">
        <Button variant="soft" color="gray" onClick={close}>
          取消
        </Button>
        <Button disabled={!zh.trim() || p.busy} onClick={create}>
          建立頁面
        </Button>
      </div>
    </Modal>
  );
}
