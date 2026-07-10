export type RoomId = "214" | "215";
export type Role = "writer" | "viewer" | "display214" | "display215";

export type Entry = {
  id: string;
  number: number;
  people: number;
  merged: boolean;
  memo: string;
  createdAt: string;
  visit1: boolean;
  visit2: boolean;
  visit3: boolean;
  wentToPlay: boolean;
};

export type EntryCheckField = "visit1" | "visit2" | "visit3" | "wentToPlay";

export type RoomData = {
  room: RoomId;
  waitMinutes: number;
  waitingCount: number;
  estimatedMinutes: number;
  entries: Entry[];
};
