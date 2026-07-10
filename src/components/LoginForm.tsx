"use client";

import { FormEvent, useState } from "react";
import type { Role } from "@/lib/types";

const options: { role: Role; label: string; detail: string }[] = [
  { role: "writer", label: "入力係", detail: "受付情報の登録と更新" },
  { role: "viewer", label: "閲覧係", detail: "214・215教室の状況確認" },
  { role: "display214", label: "214 表示", detail: "214教室前の案内画面" },
  { role: "display215", label: "215 表示", detail: "215教室前の案内画面" },
];

export default function LoginForm() {
  const [role, setRole] = useState<Role>("writer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.href = data.destination;
    } catch (e) { setError(e instanceof Error ? e.message : "ログインできませんでした"); setLoading(false); }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">CF</div>
        <p className="eyebrow">CHILDREN FESTIVAL 2026</p>
        <h1>教室受付システム</h1>
        <p className="subtle">利用する画面を選択してログインしてください</p>
        <form onSubmit={submit}>
          <div className="role-grid">
            {options.map((option) => (
              <button type="button" key={option.role} className={`role-card ${role === option.role ? "selected" : ""}`} onClick={() => setRole(option.role)}>
                <strong>{option.label}</strong><span>{option.detail}</span>
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="password">パスワード</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" autoComplete="current-password" required />
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-button wide" disabled={loading}>{loading ? "確認中…" : "ログイン"}</button>
        </form>
      </section>
    </main>
  );
}
