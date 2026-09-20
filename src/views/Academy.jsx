import React from "react";
import { Badge } from "@radix-ui/themes";
import {
  GlobeHemisphereWest,
  Stack,
  ArrowUpRight,
  PencilSimple,
  CheckCircle,
  Lightbulb,
} from "@phosphor-icons/react";

export default function Academy({ completed, setLesson }) {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">LABSITE ACADEMY</div>
          <h1>一步一步，建立你的網站。</h1>
          <p>不需要懂程式，從熟悉的研究室內容開始。</p>
        </div>
        <Badge size="2">已完成 {completed.length} / 3</Badge>
      </div>
      <div className="lesson-list">
        {[
          [
            "寫下研究室的第一段介紹",
            "把研究主題，轉成訪客能理解的故事。",
            "5 分鐘",
            PencilSimple,
          ],
          [
            "整理內容，認識共用集合",
            "一則消息，只需編輯一次。",
            "4 分鐘",
            Stack,
          ],
          [
            "分清草稿、預覽與發布",
            "確認內容之後，再向世界分享。",
            "6 分鐘",
            GlobeHemisphereWest,
          ],
        ].map(([title, desc, duration, Icon], i) => (
          <button
            className="lesson-card"
            key={title}
            onClick={() => setLesson(i)}
          >
            <span className="lesson-number">0{i + 1}</span>
            <Icon size={28} />
            <div>
              <h2>{title}</h2>
              <p>{desc}</p>
            </div>
            <span>
              {completed.includes(i) ? <CheckCircle size={24} /> : duration}
            </span>
            <ArrowUpRight size={23} />
          </button>
        ))}
      </div>
      <div className="academy-note">
        <Lightbulb size={25} />
        <div>
          <h3>先學會自己編輯，再讓 AI 幫忙。</h3>
          <p>
            初版提供固定的寫作提示。AI
            助教尚未連接，也不會代替你修改或發布網站。
          </p>
        </div>
      </div>
    </>
  );
}
