"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function getFirebaseServices() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error("Firebase Webアプリの環境変数が設定されていません");
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  return { auth: getAuth(app), db: getFirestore(app) };
}

let signInPromise: Promise<void> | null = null;

export function ensureFirebaseSignIn() {
  if (!signInPromise) {
    signInPromise = (async () => {
      const { auth } = getFirebaseServices();
      const response = await fetch("/api/firebase-token", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !data.token) throw new Error(data.error || "Firebase認証に失敗しました");
      await signInWithCustomToken(auth, data.token);
    })().catch((error) => {
      signInPromise = null;
      throw error;
    });
  }
  return signInPromise;
}

export function getRealtimeDb() {
  return getFirebaseServices().db;
}

export async function signOutFirebase() {
  signInPromise = null;
  try {
    await signOut(getFirebaseServices().auth);
  } catch {
    // Firebase設定前でも、Next.js側のログアウトは続行する。
  }
}
