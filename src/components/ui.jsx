import React from "react";
import { Tooltip, Dialog } from "@radix-ui/themes";
import { X } from "@phosphor-icons/react";
export function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function IconButton({ label, children, ...props }) {
  return (
    <Tooltip content={label}>
      <button className="icon-button" aria-label={label} {...props}>
        {children}
      </button>
    </Tooltip>
  );
}
export function Field({ label, value, onChange, area = false, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      )}
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Content
        className={wide ? "modal wide" : "modal"}
        maxWidth={wide ? "1100px" : "560px"}
      >
        <div className="modal-heading">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close>
            <IconButton label="關閉">
              <X size={20} />
            </IconButton>
          </Dialog.Close>
        </div>
        <Dialog.Description size="2" className="muted">
          {description}
        </Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
