import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase-admin";
import type {
  Entry,
  EntryCheckField,
  MergeWaitingEntry,
  RoomData,
  RoomId,
} from "@/lib/types";

export function validRoom(value: string): value is RoomId {
  return value === "214" || value === "215";
}

function isWaiting(data: DocumentData) {
  return !Boolean(data.wentToPlay ?? data.arrived);
}

export async function ensureRoomSummary(room: RoomId) {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const roomSnap = await roomRef.get();
  if (typeof roomSnap.data()?.waitingCount === "number") return;

  const entriesSnap = await roomRef.collection("entries").get();
  const waitingCount = entriesSnap.docs.reduce(
    (count, doc) => count + (isWaiting(doc.data()) ? 1 : 0),
    0,
  );

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(roomRef);
    if (typeof current.data()?.waitingCount === "number") return;
    transaction.set(roomRef, {
      waitingCount,
      waitMinutes: Number(current.data()?.waitMinutes ?? 5),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function readRoom(room: RoomId): Promise<RoomData> {
  await ensureRoomSummary(room);
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const [roomSnap, entriesSnap, mergeWaitingSnap] = await Promise.all([
    roomRef.get(),
    roomRef.collection("entries").orderBy("createdAt", "desc").limit(200).get(),
    roomRef.collection("mergeWaiting").orderBy("createdAt", "desc").limit(200).get(),
  ]);
  const waitMinutes = Number(roomSnap.data()?.waitMinutes ?? 5);
  const entries: Entry[] = entriesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      number: Number(data.number ?? 0),
      people: Number(data.people ?? 1),
      merged: Boolean(data.merged),
      memo: String(data.memo ?? ""),
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      visit1: Boolean(data.visit1),
      visit2: Boolean(data.visit2),
      visit3: Boolean(data.visit3),
      wentToPlay: Boolean(data.wentToPlay ?? data.arrived),
    };
  });
  const mergeWaitingEntries: MergeWaitingEntry[] = mergeWaitingSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      people: Number(data.people ?? 1),
      memo: String(data.memo ?? ""),
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    };
  });
  const waitingCount = Number(roomSnap.data()?.waitingCount ?? 0);
  return {
    room,
    waitMinutes,
    waitingCount,
    estimatedMinutes: waitingCount * waitMinutes,
    entries,
    mergeWaitingEntries,
  };
}

export async function addEntry(
  room: RoomId,
  input: { people: number; merged: boolean; memo: string },
) {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  if (input.merged) {
    await roomRef.collection("mergeWaiting").add({
      people: input.people,
      memo: input.memo,
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  await ensureRoomSummary(room);
  await db.runTransaction(async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    const entriesSnap = await transaction.get(
      roomRef.collection("entries").orderBy("createdAt", "asc"),
    );
    const highestExistingNumber = entriesSnap.docs.reduce(
      (highest, doc) => Math.max(highest, Number(doc.data().number ?? 0)),
      0,
    );
    const nextNumber = Math.max(
      Number(roomSnap.data()?.lastNumber ?? 0),
      highestExistingNumber,
    ) + 1;
    transaction.set(roomRef, {
      lastNumber: nextNumber,
      waitingCount: Number(roomSnap.data()?.waitingCount ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.create(roomRef.collection("entries").doc(), {
      number: nextNumber,
      people: input.people,
      merged: input.merged,
      memo: input.memo,
      visit1: false,
      visit2: false,
      visit3: false,
      wentToPlay: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function updateEntryCheck(
  room: RoomId,
  id: string,
  field: EntryCheckField,
  checked: boolean,
) {
  if (field !== "wentToPlay") {
    await getDb()
      .collection("rooms")
      .doc(room)
      .collection("entries")
      .doc(id)
      .update({ [field]: checked });
    return;
  }

  await ensureRoomSummary(room);
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const entryRef = roomRef.collection("entries").doc(id);
  const update: Record<string, boolean | FieldValue> = { [field]: checked };
  update.arrived = FieldValue.delete();
  update.arrivedAt = FieldValue.delete();
  await db.runTransaction(async (transaction) => {
    const [roomSnap, entrySnap] = await transaction.getAll(roomRef, entryRef);
    if (!entrySnap.exists) throw new Error("受付グループが見つかりません");
    const wasWaiting = isWaiting(entrySnap.data()!);
    const willBeWaiting = !checked;
    const delta = Number(willBeWaiting) - Number(wasWaiting);
    transaction.update(entryRef, update);
    if (delta !== 0) {
      transaction.set(roomRef, {
        waitingCount: Math.max(0, Number(roomSnap.data()?.waitingCount ?? 0) + delta),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

export async function deleteEntry(room: RoomId, id: string) {
  await ensureRoomSummary(room);
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const entryRef = roomRef.collection("entries").doc(id);
  await db.runTransaction(async (transaction) => {
    const [roomSnap, entrySnap] = await transaction.getAll(roomRef, entryRef);
    if (!entrySnap.exists) return;
    transaction.delete(entryRef);
    if (isWaiting(entrySnap.data()!)) {
      transaction.set(roomRef, {
        waitingCount: Math.max(0, Number(roomSnap.data()?.waitingCount ?? 0) - 1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

export async function mergeEntries(room: RoomId, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new Error("同じグループ同士は合体できません");
  await ensureRoomSummary(room);
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    const sourceRef = roomRef.collection("entries").doc(sourceId);
    const targetRef = roomRef.collection("entries").doc(targetId);
    const [roomSnap, sourceSnap, targetSnap] = await transaction.getAll(roomRef, sourceRef, targetRef);
    if (!sourceSnap.exists || !targetSnap.exists) throw new Error("合体するグループが見つかりません");
    const source = sourceSnap.data()!;
    const target = targetSnap.data()!;
    if (!isWaiting(source) || !isWaiting(target)) throw new Error("待機中のグループだけ合体できます");
    transaction.update(targetRef, {
      people: Number(target.people ?? 1) + Number(source.people ?? 1),
      merged: true,
    });
    transaction.delete(sourceRef);
    transaction.set(roomRef, {
      waitingCount: Math.max(0, Number(roomSnap.data()?.waitingCount ?? 0) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function deleteMergeWaitingEntry(room: RoomId, id: string) {
  await getDb().collection("rooms").doc(room).collection("mergeWaiting").doc(id).delete();
}

export async function deleteRoomData(room: RoomId) {
  const db = getDb();
  await db.recursiveDelete(db.collection("rooms").doc(room));
}

export async function mergeWaitingEntry(room: RoomId, id: string, targetId: string) {
  await ensureRoomSummary(room);
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    const waitingRef = roomRef.collection("mergeWaiting").doc(id);
    const targetRef = roomRef.collection("entries").doc(targetId);
    const [waitingSnap, targetSnap] = await transaction.getAll(waitingRef, targetRef);
    if (!waitingSnap.exists || !targetSnap.exists) throw new Error("合体するグループが見つかりません");
    const target = targetSnap.data()!;
    if (!isWaiting(target)) throw new Error("待機中のグループだけ合体できます");
    transaction.update(targetRef, {
      people: Number(target.people ?? 1) + Number(waitingSnap.data()?.people ?? 1),
      merged: true,
    });
    transaction.delete(waitingRef);
  });
}

export async function setWaitMinutes(room: RoomId, waitMinutes: number) {
  await ensureRoomSummary(room);
  await getDb().collection("rooms").doc(room).set({
    waitMinutes,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
