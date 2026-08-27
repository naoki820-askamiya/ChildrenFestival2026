import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { addEntry, deleteRoomData, readRoom, setWaitMinutes, validRoom } from "@/lib/rooms";

type Context = { params: Promise<{ room: string }> };

function canRead(role: string | null, room: string) {
  return role === "writer" || role === "viewer" || role === `display${room}`;
}

export async function GET(_: Request, context: Context) {
  const { room } = await context.params;
  const role = await getRole();
  if (!validRoom(room) || !canRead(role, room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  try {
    return NextResponse.json(await readRoom(room));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "読み込みに失敗しました" }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const { room } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { people, merged, memo } = (await request.json()) as {
    people?: number;
    merged?: boolean;
    memo?: string;
  };
  if (!Number.isInteger(people) || Number(people) < 1 || Number(people) > 99) return NextResponse.json({ error: "人数は1〜99人で入力してください" }, { status: 400 });
  if (typeof merged !== "boolean") return NextResponse.json({ error: "グループ合体の有無を選択してください" }, { status: 400 });
  if (typeof memo !== "string" || memo.length > 100) return NextResponse.json({ error: "マークは100文字以内で入力してください" }, { status: 400 });
  try {
    await addEntry(room, { people: Number(people), merged, memo: memo.trim() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登録に失敗しました" }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const { room } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { waitMinutes } = (await request.json()) as { waitMinutes?: number };
  if (!Number.isInteger(waitMinutes) || Number(waitMinutes) < 0 || Number(waitMinutes) > 180) return NextResponse.json({ error: "待ち時間は0〜180分で入力してください" }, { status: 400 });
  try {
    await setWaitMinutes(room, Number(waitMinutes));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "設定に失敗しました" }, { status: 503 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const { room } = await context.params;
  if ((await getRole()) !== "writer" || !validRoom(room)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  try {
    await deleteRoomData(room);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "全データの削除に失敗しました" }, { status: 503 });
  }
}
