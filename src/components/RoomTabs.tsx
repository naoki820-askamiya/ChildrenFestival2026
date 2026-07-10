import type { RoomId } from "@/lib/types";

export default function RoomTabs({ room, onChange }: { room: RoomId; onChange: (room: RoomId) => void }) {
  return <div className="segmented" aria-label="教室を選択">{(["214", "215"] as RoomId[]).map((value) => <button key={value} className={room === value ? "active" : ""} onClick={() => onChange(value)}>{value}教室</button>)}</div>;
}

