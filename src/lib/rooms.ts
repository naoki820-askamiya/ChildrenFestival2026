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

export async function readRoom(room: RoomId): Promise<RoomData> {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const [roomSnap, entriesSnap, mergeWaitingSnap, waitingSnap, legacyWaitingSnap] = await Promise.all([
    roomRef.get(),
    roomRef.collection("entries").orderBy("createdAt", "desc").limit(200).get(),
    roomRef.collection("mergeWaiting").orderBy("createdAt", "desc").limit(200).get(),
    roomRef.collection("entries").where("wentToPlay", "==", false).count().get(),
    roomRef.collection("entries").where("arrived", "==", false).count().get(),
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
  const waitingCount = waitingSnap.data().count + legacyWaitingSnap.data().count;
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
    transaction.set(roomRef, { lastNumber: nextNumber }, { merge: true });
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
  const update: Record<string, boolean | FieldValue> = { [field]: checked };
  if (field === "wentToPlay") {
    update.arrived = FieldValue.delete();
    update.arrivedAt = FieldValue.delete();
  }
  await getDb()
    .collection("rooms")
    .doc(room)
    .collection("entries")
    .doc(id)
    .update(update);
}

export async function deleteEntry(room: RoomId, id: string) {
  await getDb().collection("rooms").doc(room).collection("entries").doc(id).delete();
}

function isWaiting(data: DocumentData) {
  return !Boolean(data.wentToPlay ?? data.arrived);
}

export async function mergeEntries(room: RoomId, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new Error("同じグループ同士は合体できません");
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    const sourceRef = roomRef.collection("entries").doc(sourceId);
    const targetRef = roomRef.collection("entries").doc(targetId);
    const [sourceSnap, targetSnap] = await transaction.getAll(sourceRef, targetRef);
    if (!sourceSnap.exists || !targetSnap.exists) throw new Error("合体するグループが見つかりません");
    const source = sourceSnap.data()!;
    const target = targetSnap.data()!;
    if (!isWaiting(source) || !isWaiting(target)) throw new Error("待機中のグループだけ合体できます");
    transaction.update(targetRef, {
      people: Number(target.people ?? 1) + Number(source.people ?? 1),
      merged: true,
    });
    transaction.delete(sourceRef);
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
  await getDb().collection("rooms").doc(room).set({ waitMinutes }, { merge: true });
}
