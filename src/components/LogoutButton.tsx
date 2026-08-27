"use client";

import { signOutFirebase } from "@/lib/firebase-client";

export default function LogoutButton() {
  return <button className="ghost-button" onClick={async () => {
    await signOutFirebase();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }}>ログアウト</button>;
}
