// 其他裝置登入: a signed-in teacher makes a 15-minute one-time link for
// themselves and opens it on a phone (scan the QR code) or another computer,
// without asking the admin for a new invite.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { DeviceMobile, Copy } from "@phosphor-icons/react";
import qrcode from "qrcode-generator";
import { Modal } from "./ui";

function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: "登入用 QR code" });
}

export default function DeviceLogin({ p }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const make = async () => {
    setError(null);
    setCopied(false);
    setLink(null);
    try {
      setLink(await p.cloudCalls.deviceLink());
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (!open) return;
    make();
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [open]);
  const minutes = link ? Math.max(0, Math.round((link.expiresAt - now) / 60000)) : 0;
  return (
    <>
      <button className="icon-link device-login-btn" onClick={() => setOpen(true)} title="在手機或另一台電腦登入">
        <DeviceMobile size={18} />
        <span>其他裝置登入</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="在其他裝置登入" description="用手機相機掃描 QR code，或把連結傳到另一台電腦打開，就能用同一個帳號登入。">
        {error && <p className="error-text">{error}</p>}
        {link && (
          <div className="device-login">
            {/* The SVG is generated locally from our own sign-in URL. */}
            <div className="device-qr" dangerouslySetInnerHTML={{ __html: qrSvg(link.url) }} />
            <div className="invite-row">
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="登入連結" />
              <Button
                size="1"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={14} /> {copied ? "已複製" : "複製"}
              </Button>
            </div>
            <p className="small-note">
              {minutes > 0 ? `${minutes} 分鐘內有效，只能用一次。` : "這條連結已過期。"}這條連結等於你的帳號，請不要傳給別人。新裝置登入後，持續使用就不會被登出。
            </p>
            <Button variant="soft" onClick={make}>
              重新產生
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
