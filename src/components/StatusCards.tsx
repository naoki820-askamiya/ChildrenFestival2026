import type { RoomData } from "@/lib/types";

export default function StatusCards({ data }: { data: RoomData | null }) {
  return <div className="status-grid">
    <section className="metric-card accent"><p>現在の待ちグループ</p><strong>{data?.waitingCount ?? "—"}<small>組</small></strong></section>
    <section className="metric-card"><p>推定待ち時間</p><strong>{data?.estimatedMinutes ?? "—"}<small>分</small></strong></section>
    <section className="metric-card compact"><p>1組あたり</p><strong>{data?.waitMinutes ?? "—"}<small>分</small></strong></section>
  </div>;
}

