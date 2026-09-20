import React from "react";
import { Button } from "@radix-ui/themes";
import {
  Stack,
  Plus,
  FloppyDisk,
  ArrowUp,
  Trash,
  FileText,
} from "@phosphor-icons/react";
import { Field, IconButton } from "../components/ui";
import { typeNames } from "../domain/project";

export default function Collections({
  draft,
  change,
  collection,
  setCollection,
  query,
  setQuery,
  setConfirm,
  dirty,
  save,
  saving,
  conflict,
}) {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>內容集合</h1>
          <p>一次修改，自動同步至引用這份內容的區塊。</p>
        </div>
        <Button
          disabled={draft.collections[collection].length >= 500}
          onClick={() => {
            const item = {
              id: crypto.randomUUID(),
              title: "",
              description: "",
              ...(collection === "news"
                ? { date: new Date().toLocaleDateString("en-CA") }
                : {}),
            };
            change((d) => {
              d.collections[collection].unshift(item);
              return d;
            });
          }}
        >
          <Plus size={18} />
          新增項目
        </Button>
      </div>
      <div className="content-toolbar">
        <div className="tab-row">
          {["news", "research", "team"].map((t) => (
            <button
              className={collection === t ? "active" : ""}
              onClick={() => {
                setCollection(t);
                setQuery("");
              }}
              key={t}
            >
              {typeNames[t]}
              <span>{draft.collections[t].length}</span>
            </button>
          ))}
        </div>
        <input
          className="search"
          aria-label="搜尋內容"
          placeholder="搜尋標題或內文…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="collection-list">
        {draft.collections[collection]
          .filter((x) => (x.title + x.description).includes(query))
          .map((item) => (
            <article className="collection-item" key={item.id}>
              <div className="collection-icon">
                <FileText size={22} />
              </div>
              <div className="collection-fields">
                <Field
                  label="標題"
                  value={item.title}
                  placeholder="輸入標題"
                  onChange={(title) =>
                    change((d) => {
                      d.collections[collection] = d.collections[collection].map(
                        (x) => (x.id === item.id ? { ...x, title } : x),
                      );
                      return d;
                    }, `collection:${collection}:${item.id}:title`)
                  }
                />
                <Field
                  label="內文"
                  area
                  rows={2}
                  value={item.description}
                  onChange={(description) =>
                    change((d) => {
                      d.collections[collection] = d.collections[collection].map(
                        (x) => (x.id === item.id ? { ...x, description } : x),
                      );
                      return d;
                    }, `collection:${collection}:${item.id}:description`)
                  }
                />
                {collection === "news" && (
                  <Field
                    label="日期"
                    type="date"
                    value={item.date}
                    onChange={(date) =>
                      change((d) => {
                        d.collections.news = d.collections.news.map((x) =>
                          x.id === item.id ? { ...x, date } : x,
                        );
                        return d;
                      }, `collection:${collection}:${item.id}:date`)
                    }
                  />
                )}
              </div>
              <div className="button-row">
                <IconButton
                  label="上移項目"
                  disabled={draft.collections[collection][0].id === item.id}
                  onClick={() =>
                    change((d) => {
                      const i = d.collections[collection].findIndex(
                        (x) => x.id === item.id,
                      );
                      [
                        d.collections[collection][i - 1],
                        d.collections[collection][i],
                      ] = [
                        d.collections[collection][i],
                        d.collections[collection][i - 1],
                      ];
                      return d;
                    })
                  }
                >
                  <ArrowUp size={18} />
                </IconButton>
                <IconButton
                  label="刪除項目"
                  onClick={() =>
                    setConfirm({
                      title: "刪除這個項目？",
                      description:
                        "引用此集合的所有區塊都會同步移除此項目，保存前可在編輯器復原。",
                      action: () =>
                        change((d) => {
                          d.collections[collection] = d.collections[
                            collection
                          ].filter((x) => x.id !== item.id);
                          return d;
                        }),
                    })
                  }
                >
                  <Trash size={18} />
                </IconButton>
              </div>
            </article>
          ))}
        {!draft.collections[collection].filter((x) =>
          (x.title + x.description).includes(query),
        ).length && (
          <div className="empty">
            <Stack size={38} />
            <h3>{query ? "沒有符合的內容" : "這個集合還沒有內容"}</h3>
            <p>{query ? "試試其他關鍵字。" : "點選「新增項目」開始填寫。"}</p>
          </div>
        )}
      </div>
      <div className="sticky-save">
        <span>
          {dirty ? "內容有變更，記得保存草稿。" : "已與目前草稿同步。"}
        </span>
        <Button onClick={save} disabled={saving || conflict}>
          <FloppyDisk size={18} />
          保存草稿
        </Button>
      </div>
    </>
  );
}
