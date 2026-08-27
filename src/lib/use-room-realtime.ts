"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureFirebaseSignIn, getRealtimeDb } from "@/lib/firebase-client";
import type { Entry, MergeWaitingEntry, RoomData, RoomId } from "@/lib/types";

type Options = {
  includeEntries?: boolean;
  includeMergeWaiting?: boolean;
};

function isoDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function toEntry(snapshot: QueryDocumentSnapshot<DocumentData>): Entry {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    number: Number(data.number ?? 0),
    people: Number(data.people ?? 1),
    merged: Boolean(data.merged),
    memo: String(data.memo ?? ""),
    createdAt: isoDate(data.createdAt),
    visit1: Boolean(data.visit1),
    visit2: Boolean(data.visit2),
    visit3: Boolean(data.visit3),
    wentToPlay: Boolean(data.wentToPlay ?? data.arrived),
  };
}

function toMergeWaiting(snapshot: QueryDocumentSnapshot<DocumentData>): MergeWaitingEntry {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    people: Number(data.people ?? 1),
    memo: String(data.memo ?? ""),
    createdAt: isoDate(data.createdAt),
  };
}

function emptyRoom(room: RoomId): RoomData {
  return {
    room,
    waitMinutes: 5,
    waitingCount: 0,
    estimatedMinutes: 0,
    entries: [],
    mergeWaitingEntries: [],
  };
}

export function useRoomRealtime(room: RoomId, options: Options = {}) {
  const { includeEntries = false, includeMergeWaiting = false } = options;
  const [data, setData] = useState<RoomData | null>(null);
  const [errorState, setErrorState] = useState<{ room: RoomId; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribers: Unsubscribe[] = [];
    const fail = (subscriptionError: Error) => {
      if (active) setErrorState({
        room,
        message: subscriptionError.message || "リアルタイム更新に接続できませんでした",
      });
    };

    void ensureFirebaseSignIn()
      .then(() => {
        if (!active) return;
        const db = getRealtimeDb();
        const roomRef = doc(db, "rooms", room);

        unsubscribers.push(onSnapshot(roomRef, (snapshot) => {
          if (!active) return;
          const roomData = snapshot.data();
          const waitMinutes = Number(roomData?.waitMinutes ?? 5);
          const waitingCount = Number(roomData?.waitingCount ?? 0);
          setData((current) => ({
            ...(current?.room === room ? current : emptyRoom(room)),
            room,
            waitMinutes,
            waitingCount,
            estimatedMinutes: waitingCount * waitMinutes,
          }));
          setErrorState(null);
        }, fail));

        if (includeEntries) {
          const entriesQuery = query(
            collection(roomRef, "entries"),
            orderBy("createdAt", "desc"),
            limit(200),
          );
          unsubscribers.push(onSnapshot(entriesQuery, (snapshot) => {
            if (!active) return;
            setData((current) => ({
              ...(current?.room === room ? current : emptyRoom(room)),
              room,
              entries: snapshot.docs.map(toEntry),
            }));
            setErrorState(null);
          }, fail));
        }

        if (includeMergeWaiting) {
          const mergeWaitingQuery = query(
            collection(roomRef, "mergeWaiting"),
            orderBy("createdAt", "desc"),
            limit(200),
          );
          unsubscribers.push(onSnapshot(mergeWaitingQuery, (snapshot) => {
            if (!active) return;
            setData((current) => ({
              ...(current?.room === room ? current : emptyRoom(room)),
              room,
              mergeWaitingEntries: snapshot.docs.map(toMergeWaiting),
            }));
            setErrorState(null);
          }, fail));
        }
      })
      .catch((connectionError) => {
        fail(connectionError instanceof Error ? connectionError : new Error("リアルタイム更新に接続できませんでした"));
      });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [includeEntries, includeMergeWaiting, room]);

  return {
    data: data?.room === room ? data : null,
    error: errorState?.room === room ? errorState.message : "",
  };
}
