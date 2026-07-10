import { NextResponse } from "next/server";
import { createSession, passwordFor } from "@/lib/auth";
import type { Role } from "@/lib/types";

const roles: Role[] = ["writer", "viewer", "display214", "display215"];

export async function POST(request: Request) {
  const { role, password } = (await request.json()) as { role?: Role; password?: string };
  if (!role || !roles.includes(role) || !password) {
    return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
  }
  const expected = passwordFor(role);
  if (!expected) {
    return NextResponse.json({ error: "パスワードがまだ設定されていません" }, { status: 503 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  await createSession(role);
  const destination = role === "writer" ? "/writer" : role === "viewer" ? "/viewer" : `/display/${role.slice(-3)}`;
  return NextResponse.json({ destination });
}

