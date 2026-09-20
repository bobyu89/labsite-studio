import React from "react";
import { Button, Select, Switch } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Eye,
  FloppyDisk,
  ArrowUpRight,
  FileText,
} from "@phosphor-icons/react";
import { IconButton } from "../components/ui";
import ThemePanel from "../components/ThemePanel";
import BlockInspector from "../components/BlockInspector";
import PreviewCanvas from "../components/PreviewCanvas";
import { homepage, typeNames, newBlock } from "../domain/project";
export default function Editor({
  draft,
  change,
  save,
  saving,
  conflict,
  undo,
  redo,
  canUndo,
  canRedo,
  setPreview,
  openPublish,
  selected,
  setSelected,
  tab,
  setTab,
  setConfirm,
  editCollection,
  device,
  setDevice,
  doc,
}) {
  const page = homepage(draft);
  const chosen = page.blocks.find((b) => b.id === selected) ?? page.blocks[0];
  return (
    <>
      <div className="editor-heading">
        <div>
          <h1>網站編輯</h1>
          <p>修改草稿不會影響正式網站。</p>
        </div>
        <div className="button-row">
          <IconButton label="復原" onClick={undo} disabled={!canUndo}>
            <ArrowCounterClockwise size={19} />
          </IconButton>
          <IconButton label="重做" onClick={redo} disabled={!canRedo}>
            <ArrowClockwise size={19} />
          </IconButton>
          <Button variant="surface" onClick={() => setPreview(true)}>
            <Eye size={18} />
            預覽
          </Button>
          <Button onClick={save} disabled={saving || conflict}>
            <FloppyDisk size={18} />
            {saving ? "保存中" : "保存草稿"}
          </Button>
          <Button variant="surface" onClick={openPublish}>
            發布檢查
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </div>
      <div className="editor-layout">
        <aside className="inspector">
          <div className="inspector-tabs">
            {[
              ["blocks", "頁面區塊"],
              ["style", "全站外觀"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "style" ? (
            <ThemePanel draft={draft} change={change} />
          ) : (
            <>
              <div className="page-label">
                <FileText size={17} />
                <strong>{page.name}</strong>
                <span>{page.path}</span>
              </div>
              <div className="block-list">
                {page.blocks.map((b, i) => (
                  <div
                    className={
                      "block-row " + (chosen.id === b.id ? "selected" : "")
                    }
                    key={b.id}
                  >
                    <button onClick={() => setSelected(b.id)}>
                      <span className="block-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={!b.visible ? "muted" : ""}>
                        {b.title}
                      </span>
                    </button>
                    <Switch
                      size="1"
                      checked={b.visible}
                      aria-label={"顯示" + b.title}
                      onCheckedChange={(visible) =>
                        change((d) => {
                          homepage(d).blocks.find(
                            (x) => x.id === b.id,
                          ).visible = visible;
                          return d;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <Select.Root
                value=""
                onValueChange={(type) => {
                  const id = crypto.randomUUID();
                  change((d) => {
                    homepage(d).blocks.push(newBlock(type, id));
                    return d;
                  });
                  setSelected(id);
                }}
              >
                <Select.Trigger
                  placeholder="＋ 新增區塊"
                  className="add-block"
                  disabled={page.blocks.length >= 50}
                />
                <Select.Content>
                  {Object.entries(typeNames).map(([type, label]) => (
                    <Select.Item key={type} value={type}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <BlockInspector
                draft={draft}
                block={chosen}
                change={change}
                setSelected={setSelected}
                setConfirm={setConfirm}
                editCollection={editCollection}
              />
            </>
          )}
        </aside>
        <PreviewCanvas doc={doc} device={device} setDevice={setDevice} />
      </div>
    </>
  );
}
