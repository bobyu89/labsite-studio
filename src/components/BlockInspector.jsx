import React from "react";
import { Button, Select } from "@radix-ui/themes";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Trash,
  ArrowRight,
} from "@phosphor-icons/react";
import { IconButton, Field } from "./ui";
import { homepage, typeNames } from "../domain/project";
import { moveBlock } from "../model";
export default function BlockInspector({
  draft,
  block,
  change,
  setSelected,
  setConfirm,
  editCollection,
}) {
  const blocks = homepage(draft).blocks;
  function update(patch, group) {
    change((d) => {
      const b = homepage(d).blocks.find((x) => x.id === block.id);
      Object.assign(b, patch);
      return d;
    }, group);
  }
  function props(key, value) {
    change((d) => {
      homepage(d).blocks.find((b) => b.id === block.id).props[key] = value;
      return d;
    }, `block:${block.id}:${key}`);
  }
  return (
    <div className="block-editor">
      <div className="inspector-title">
        <h3>{typeNames[block.type]}</h3>
        <div className="button-row">
          <IconButton
            label="上移區塊"
            disabled={blocks[0].id === block.id}
            onClick={() => change(moveBlock(draft, block.id, -1))}
          >
            <ArrowUp size={16} />
          </IconButton>
          <IconButton
            label="下移區塊"
            disabled={blocks.at(-1).id === block.id}
            onClick={() => change(moveBlock(draft, block.id, 1))}
          >
            <ArrowDown size={16} />
          </IconButton>
          <IconButton
            label="複製區塊"
            disabled={blocks.length >= 50}
            onClick={() => {
              const id = crypto.randomUUID();
              change((d) => {
                homepage(d).blocks.push({
                  ...structuredClone(block),
                  id,
                  title: block.title + " 副本",
                });
                return d;
              });
              setSelected(id);
            }}
          >
            <Copy size={16} />
          </IconButton>
          <IconButton
            label="刪除區塊"
            disabled={blocks.length === 1}
            onClick={() =>
              setConfirm({
                title: "刪除這個區塊？",
                description:
                  "只移除目前草稿的區塊，共用內容集合仍然保留。也可以使用復原找回。",
                action: () =>
                  change((d) => {
                    homepage(d).blocks = homepage(d).blocks.filter(
                      (b) => b.id !== block.id,
                    );
                    return d;
                  }),
              })
            }
          >
            <Trash size={16} />
          </IconButton>
        </div>
      </div>
      <Field
        label="區塊名稱"
        value={block.title}
        onChange={(title) => update({ title }, `block:${block.id}:name`)}
      />
      {block.type === "hero" ? (
        <>
          <Field
            label="首頁標題"
            value={block.props.title}
            maxLength={70}
            onChange={(value) => props("title", value)}
          />
          <Field
            label="研究室介紹"
            area
            rows={5}
            value={block.props.description}
            onChange={(value) => props("description", value)}
          />
          <label className="field">
            <span>主視覺版型</span>
            <Select.Root
              value={block.props.layout}
              onValueChange={(value) => props("layout", value)}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="split">左右分欄</Select.Item>
                <Select.Item value="center">置中敘事</Select.Item>
              </Select.Content>
            </Select.Root>
          </label>
          <label className="field">
            <span>區塊圖片</span>
            <Select.Root
              value={block.props.cover ?? "none"}
              onValueChange={(value) =>
                props("cover", value === "none" ? null : value)
              }
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="none">不使用圖片</Select.Item>
                {draft.assets.map((a) => (
                  <Select.Item key={a.id} value={a.id}>
                    {a.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>
          <p className="small-note">這個主視覺的文字、圖片與版型可獨立修改。</p>
        </>
      ) : (
        <>
          <p className="small-note">
            引用「{typeNames[block.collectionId]}
            」共用集合，修改內容會同步至其他引用此集合的區塊。
          </p>
          <Button
            variant="surface"
            onClick={() => editCollection(block.collectionId)}
          >
            編輯 {draft.collections[block.collectionId].length} 個項目{" "}
            <ArrowRight size={16} />
          </Button>
        </>
      )}
    </div>
  );
}
