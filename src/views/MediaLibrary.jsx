import React from "react";
import { Button } from "@radix-ui/themes";
import { Images, Trash, UploadSimple } from "@phosphor-icons/react";
import { Field, IconButton } from "../components/ui";
import { firstHero } from "../domain/project";

export default function MediaLibrary({
  draft,
  change,
  upload,
  addAssets,
  setConfirm,
  save,
  saving,
  conflict,
}) {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>素材庫</h1>
          <p>整理網站圖片，補上替代文字，讓更多人讀懂你的研究。</p>
        </div>
        <Button onClick={() => upload.current.click()}>
          <UploadSimple size={18} />
          上傳圖片
        </Button>
        <input
          ref={upload}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            addAssets([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addAssets([...e.dataTransfer.files]);
        }}
      >
        <Images size={36} />
        <h3>把圖片拖曳到這裡</h3>
        <p>JPG、PNG、WebP，每張上限 2 MB，共 8 張。</p>
        <Button variant="surface" onClick={() => upload.current.click()}>
          選擇圖片
        </Button>
      </div>
      <div className="media-grid">
        {draft.assets.map((a) => (
          <article className="media-card" key={a.id}>
            <img src={a.src} alt={a.alt || "尚未填寫替代文字的素材"} />
            <div>
              <strong>{a.name}</strong>
              <Field
                label="替代文字"
                value={a.alt}
                placeholder="簡短描述圖片中的內容"
                onChange={(alt) =>
                  change((d) => {
                    d.assets = d.assets.map((x) =>
                      x.id === a.id ? { ...x, alt } : x,
                    );
                    return d;
                  })
                }
              />
              <div className="button-row">
                <Button
                  size="1"
                  disabled={!firstHero(draft)}
                  variant={
                    firstHero(draft)?.props.cover === a.id ? "solid" : "surface"
                  }
                  onClick={() =>
                    change((d) => {
                      const hero = firstHero(d);
                      if (hero)
                        hero.props.cover =
                          hero.props.cover === a.id ? null : a.id;
                      return d;
                    })
                  }
                >
                  {firstHero(draft)?.props.cover === a.id
                    ? "取消首頁圖片"
                    : "用於首頁"}
                </Button>
                <IconButton
                  label={"移除 " + a.name}
                  onClick={() =>
                    setConfirm({
                      title: "從草稿移除圖片？",
                      description:
                        "若首頁正在使用此圖，也會一併移除；已保存的歷史版本仍保留圖片。",
                      action: () =>
                        change((d) => {
                          d.assets = d.assets.filter((x) => x.id !== a.id);
                          d.pages.forEach((p) =>
                            p.blocks.forEach((b) => {
                              if (b.type === "hero" && b.props.cover === a.id)
                                b.props.cover = null;
                            }),
                          );
                          return d;
                        }),
                    })
                  }
                >
                  <Trash size={18} />
                </IconButton>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="sticky-save">
        <span>圖片僅保存在本機草稿中，尚未上傳雲端。</span>
        <Button onClick={save} disabled={saving || conflict}>
          保存草稿
        </Button>
      </div>
    </>
  );
}
