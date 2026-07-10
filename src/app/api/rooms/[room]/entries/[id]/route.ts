import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { deleteEntry, updateEntryCheck, validRoom } from "@/lib/rooms";
import type { EntryCheckField } from "@/lib/types";

type Context = { params: Promise<{ room: string; id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { room, id } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { field, checked } = (await request.json()) as {
    field?: EntryCheckField;
    checked?: boolean;
  };
  const allowedFields: EntryCheckField[] = ["visit1", "visit2", "visit3", "wentToPlay"];
  if (!field || !allowedFields.includes(field) || typeof checked !== "boolean") {
    return NextResponse.json({ error: "更新内容が正しくありません" }, { status: 400 });
  }
  try {
    await updateEntryCheck(room, id, field, checked);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新に失敗しました" }, { status: 503 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const { room, id } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  try {
    await deleteEntry(room, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "削除に失敗しました" }, { status: 503 });
  }
}
