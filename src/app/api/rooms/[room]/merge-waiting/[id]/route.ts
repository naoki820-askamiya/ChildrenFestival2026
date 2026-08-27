import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { deleteMergeWaitingEntry, mergeWaitingEntry, validRoom } from "@/lib/rooms";

type Context = { params: Promise<{ room: string; id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { room, id } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { targetId } = (await request.json()) as { targetId?: string };
  if (typeof targetId !== "string" || !targetId) return NextResponse.json({ error: "合体先を選択してください" }, { status: 400 });
  try {
    await mergeWaitingEntry(room, id, targetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "合体に失敗しました" }, { status: 503 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const { room, id } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  try {
    await deleteMergeWaitingEntry(room, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "削除に失敗しました" }, { status: 503 });
  }
}
