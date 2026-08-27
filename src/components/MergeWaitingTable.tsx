"use client";

import type { MergeWaitingEntry } from "@/lib/types";

function time(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MergeWaitingTable({
  entries,
  busyId,
  onMerge,
  onDelete,
}: {
  entries: MergeWaitingEntry[];
  busyId?: string;
  onMerge: (entry: MergeWaitingEntry) => void;
  onDelete: (entry: MergeWaitingEntry) => void;
}) {
  if (!entries.length) {
    return (
      <div className="empty-state compact-empty">
        <strong>合体待ちのグループはありません</strong>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="merge-waiting-table">
        <thead>
          <tr>
            <th>登録時刻</th>
            <th>人数</th>
            <th>マーク</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{time(entry.createdAt)}</td>
              <td><strong>{entry.people}</strong> 人</td>
              <td className="memo-cell">{entry.memo || "なし"}</td>
              <td><div className="table-actions">
                <button
                  className="merge-button table-action"
                  disabled={busyId === entry.id}
                  onClick={() => onMerge(entry)}
                >
                  合体
                </button>
                <button
                  className="delete-button table-action"
                  disabled={busyId === entry.id}
                  onClick={() => onDelete(entry)}
                >
                  キャンセル
                </button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
