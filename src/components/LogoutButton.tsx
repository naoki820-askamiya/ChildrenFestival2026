"use client";

export default function LogoutButton() {
  return <button className="ghost-button" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/"; }}>ログアウト</button>;
}

