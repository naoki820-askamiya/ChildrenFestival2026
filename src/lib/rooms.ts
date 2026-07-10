import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase-admin";
import type { Entry, EntryCheckField, RoomData, RoomId } from "@/lib/types";

export function validRoom(value: string): value is RoomId {
  return value === "214" || value === "215";
}

export async function readRoom(room: RoomId): Promise<RoomData> {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  const [roomSnap, entriesSnap, waitingSnap, legacyWaitingSnap] = await Promise.all([
    roomRef.get(),
    roomRef.collection("entries").orderBy("createdAt", "desc").limit(200).get(),
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
  const waitingCount = waitingSnap.data().count + legacyWaitingSnap.data().count;
  return {
    room,
    waitMinutes,
    waitingCount,
    estimatedMinutes: waitingCount * waitMinutes,
    entries,
  };
}

export async function addEntry(
  room: RoomId,
  input: { people: number; merged: boolean; memo: string },
) {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    await transaction.get(roomRef);
    const entriesSnap = await transaction.get(
      roomRef.collection("entries").orderBy("createdAt", "asc"),
    );
    const nextNumber = entriesSnap.size + 1;
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
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    await transaction.get(roomRef);
    const entriesSnap = await transaction.get(
      roomRef.collection("entries").orderBy("createdAt", "asc"),
    );
    const remaining = entriesSnap.docs.filter((doc) => doc.id !== id);
    transaction.delete(roomRef.collection("entries").doc(id));
    remaining.forEach((doc, index) => {
      const number = index + 1;
      if (Number(doc.data().number) !== number) {
        transaction.update(doc.ref, { number });
      }
    });
    transaction.set(roomRef, { lastNumber: remaining.length }, { merge: true });
  });
}

export async function renumberRoom(room: RoomId) {
  const db = getDb();
  const roomRef = db.collection("rooms").doc(room);
  await db.runTransaction(async (transaction) => {
    await transaction.get(roomRef);
    const entriesSnap = await transaction.get(
      roomRef.collection("entries").orderBy("createdAt", "asc"),
    );
    entriesSnap.docs.forEach((doc, index) => {
      const number = index + 1;
      if (Number(doc.data().number) !== number) {
        transaction.update(doc.ref, { number });
      }
    });
    transaction.set(roomRef, { lastNumber: entriesSnap.size }, { merge: true });
  });
}

export async function setWaitMinutes(room: RoomId, waitMinutes: number) {
  await getDb().collection("rooms").doc(room).set({ waitMinutes }, { merge: true });
}
