// 你想做什麼？ The first thing shown when a site opens: the handful of jobs a
// lab actually comes here for, each one click away from the right place.
// Someone who edits once a month should not have to remember which tab or
// page a job lives on.
import React from "react";
import { BookOpenText, UsersThree, Images, Megaphone, PencilSimpleLine, AddressBook } from "@phosphor-icons/react";

export default function TaskHome({ tasks, more, onClose }) {
  return (
    <section className="task-home" aria-labelledby="task-home-title">
      <h2 id="task-home-title">你想做什麼？</h2>
      <p className="small-note">選一件事，會直接帶你到要改的地方。之後可以按上方的「我想做…」回到這裡。</p>
      <div className="task-grid">
        {tasks.map((t) => (
          <button key={t.id} className="task-card" onClick={t.run}>
            <t.icon size={30} weight="duotone" />
            <strong>{t.title}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>
      <p className="task-more">
        其他：
        {more.map((m, i) => (
          <React.Fragment key={m.title}>
            {i > 0 && "・"}
            <button className="text-link" onClick={m.run}>
              {m.title}
            </button>
          </React.Fragment>
        ))}
        ・
        <button className="text-link" onClick={onClose}>
          直接看整個編輯畫面
        </button>
      </p>
    </section>
  );
}

export const TASK_ICONS = { pub: BookOpenText, members: UsersThree, photos: Images, news: Megaphone, text: PencilSimpleLine, contact: AddressBook };
