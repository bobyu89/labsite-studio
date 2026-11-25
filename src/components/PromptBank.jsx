// 版面靈感: pick a kind of section, and its request goes into the AI box with
// ［　］ blanks to fill in. The assistant then proposes the whole block.
import React, { useState } from "react";
import { Modal } from "./ui";
import { PROMPT_BANK, PROMPT_GROUPS } from "../site/promptBank.js";
import { blockById } from "../site/blockCatalog.js";

export default function PromptBank({ open, onClose, onPick, where }) {
  const [group, setGroup] = useState(PROMPT_GROUPS[0]);
  return (
    <Modal open={open} onClose={onClose} title="用 AI 寫一段新內容" description={`選一種常見的段落，填上［　］裡的資料，助手會寫好整段給你看，按「套用」才會加入（${where}）。`}>
      <div className="lib-chips prompt-groups" role="tablist">
        {PROMPT_GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? "active" : ""} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <ul className="prompt-list">
        {PROMPT_BANK.filter((x) => x.group === group).map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => {
                onPick(x.prompt);
                onClose();
              }}
            >
              <strong>{x.title}</strong>
              <span>{x.hint}</span>
              <small>版面：{blockById(x.block)?.name}</small>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
