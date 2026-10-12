// Email + password: the sign-in form (signed out) and 設定密碼 (signed in).
// Field names and autocomplete hints let browsers and phones save the password.
import React, { useState } from "react";
import { Button } from "@radix-ui/themes";
import { Key } from "@phosphor-icons/react";
import { Modal } from "./ui";

export function PasswordLoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="password-login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onLogin(email.trim(), password);
        } catch (err) {
          setError(err.message);
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>Email</span>
        <input type="email" name="username" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>密碼</span>
        <input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <Button size="3" type="submit" disabled={busy || !email || !password}>
        {busy ? "登入中…" : "登入"}
      </Button>
    </form>
  );
}

export function PasswordDialog({ p, open, onClose }) {
  const me = p.cloud.me;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setCurrent("");
    setNext("");
    setAgain("");
    setError(null);
    setDone(false);
  };
  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={me?.hasPassword ? "更改密碼" : "設定密碼"}
      description="設定後，換電腦或用手機時，打開網址輸入 Email 和密碼就能登入，不用再找管理者要連結。"
    >
      {done ? (
        <div className="password-done">
          <p>密碼已{me?.hasPassword ? "更新" : "設定"}。下次登入時輸入 {me?.email} 和這個密碼即可。</p>
          <Button onClick={onClose}>好</Button>
        </div>
      ) : (
        <form
          className="password-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (next !== again) return setError("兩次輸入的新密碼不一樣。");
            setBusy(true);
            setError(null);
            try {
              await p.cloudCalls.setPassword(next, current);
              await p.refreshCloud?.();
              setDone(true);
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {/* Lets password managers file the new password under this account. */}
          <input type="email" name="username" autoComplete="username" value={me?.email || ""} readOnly hidden />
          {me?.hasPassword && (
            <label className="field">
              <span>目前的密碼（剛用登入連結登入的話可以留白）</span>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>新密碼（至少 8 個字元）</span>
            <input type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span>再輸入一次</span>
            <input type="password" autoComplete="new-password" minLength={8} required value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="submit" disabled={busy || next.length < 8}>
              {busy ? "處理中…" : "儲存密碼"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function PasswordButton({ onClick, hasPassword }) {
  return (
    <button className="icon-link device-login-btn" onClick={onClick} title={hasPassword ? "更改密碼" : "設定密碼，換電腦也能登入"}>
      <Key size={18} />
      <span>{hasPassword ? "密碼" : "設定密碼"}</span>
    </button>
  );
}
