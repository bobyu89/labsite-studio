// 誰也在編輯: the others who have this site open (presence heartbeats).
// Same page → a warning, since the later save would replace the earlier
// one; another page → a quiet note with a link to it.
import React from "react";
import { Users, Warning } from "@phosphor-icons/react";

const nameOf = (email) => String(email).split("@")[0];

export default function Presence({ others, current, labelOf, onOpen }) {
  if (!others?.length) return null;
  const here = others.filter((o) => o.page === current);
  const elsewhere = others.filter((o) => o.page !== current);
  return (
    <span className="presence">
      {here.length > 0 && (
        <span className="presence-here" role="status" title="兩個人同時改同一頁，後存的會蓋掉先存的。可以先講好誰改哪裡。">
          <Warning size={15} weight="fill" /> {here.map((o) => nameOf(o.email)).join("、")} 也在改這一頁
        </span>
      )}
      {elsewhere.length > 0 && (
        <span className="presence-else">
          <Users size={15} />
          {elsewhere.map((o, i) => (
            <React.Fragment key={o.email}>
              {i > 0 && "、"}
              <button type="button" className="text-link" title={o.email} onClick={() => onOpen(o.page)} disabled={!o.page}>
                {nameOf(o.email)}
              </button>
              {o.page ? `（${labelOf(o.page)}）` : ""}
            </React.Fragment>
          ))}
          <span className="muted"> 也在編輯</span>
        </span>
      )}
    </span>
  );
}
