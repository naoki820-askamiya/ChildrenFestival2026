import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { ensureRoomSummary } from "@/lib/rooms";
import type { RoomId } from "@/lib/types";

export async function POST() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const rooms: RoomId[] = role === "display214"
    ? ["214"]
    : role === "display215"
      ? ["215"]
      : ["214", "215"];

  try {
    await Promise.all(rooms.map(ensureRoomSummary));
    const token = await getAdminAuth().createCustomToken(`children-festival-${role}`, { role });
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "リアルタイム接続を開始できませんでした",
    }, { status: 503 });
  }
}
