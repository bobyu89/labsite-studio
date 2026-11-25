// 請老師發布 (review requests): what the teacher and the student each see in
// the editor. Teacher: who asked, their note, 看改了什麼並發布 or 退回並留言.
// Student: waiting, or the teacher's reply when it was sent back.
import React, { useState } from "react";
import { Button } from "@radix-ui/themes";

const when = (t) => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);
const nameOf = (email) => String(email || "").split("@")[0];

export default function ReviewBanner({ p, onPublish }) {
  const site = p.cloudSite;
  const review = site?.review;
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!review) return null;
  const teacher = site.role !== "contributor";
  const mine = review.by === p.cloud.me?.email;

  if (review.status === "waiting" && teacher && !mine)
    return (
      <div className="review-banner" role="status">
        <p>
          <strong>{nameOf(review.by)}</strong> 請你看看並發布<span className="muted">（{when(review.at)}）</span>
        </p>
        {review.note && <blockquote>{review.note}</blockquote>}
        {replying ? (
          <form
            className="review-reply"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await p.cloudCalls.returnReview(site.id, text);
                await p.refreshCloud();
                setReplying(false);
                p.notify("已退回，對方打開編輯畫面會看到你的留言。");
              } catch (err) {
                p.setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="要再改哪裡？例如：第二則消息的日期請再確認" autoFocus />
            <div>
              <Button size="1" type="submit" disabled={busy}>
                送出留言
              </Button>
              <button type="button" className="text-link" onClick={() => setReplying(false)}>
                取消
              </button>
            </div>
          </form>
        ) : (
          <div className="review-actions">
            <Button size="1" color="orange" onClick={onPublish} disabled={p.busy}>
              看改了什麼並發布
            </Button>
            <button type="button" className="text-link" onClick={() => setReplying(true)}>
              退回並留言
            </button>
          </div>
        )}
      </div>
    );
  if (review.status === "waiting")
    return (
      <div className="review-banner quiet" role="status">
        <p>已送給老師（{when(review.at)}），等老師看過後發布。之後的修改也會一起給老師看。</p>
      </div>
    );
  if (review.status === "returned" && (!teacher || mine))
    return (
      <div className="review-banner" role="status">
        <p>
          <strong>{nameOf(review.replyBy)}</strong> 退回了這次的修改<span className="muted">（{when(review.replyAt)}）</span>
        </p>
        {review.reply && <blockquote>{review.reply}</blockquote>}
        <p className="small-note">改好之後，再按上方的「請老師發布」。</p>
      </div>
    );
  return null;
}
