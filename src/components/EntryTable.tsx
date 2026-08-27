"use client";

import type { Entry, EntryCheckField } from "@/lib/types";

function time(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const checkColumns: { field: EntryCheckField; label: string }[] = [
  { field: "visit1", label: "来室1" },
  { field: "visit2", label: "来室2" },
  { field: "visit3", label: "来室3" },
  { field: "wentToPlay", label: "遊びに行ったよ" },
];

function CheckCell({
  entry,
  field,
  editable,
  disabled,
  onToggle,
}: {
  entry: Entry;
  field: EntryCheckField;
  editable: boolean;
  disabled: boolean;
  onToggle?: (entry: Entry, field: EntryCheckField) => void;
}) {
  const checked = entry[field];
  if (!editable) {
    return (
      <span className={`check-indicator ${checked ? "checked" : ""}`} aria-label={checked ? "チェック済み" : "未チェック"}>
        {checked ? "✓" : ""}
      </span>
    );
  }
  return (
    <input
      className="row-checkbox"
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={`受付番号${entry.number}の${field}`}
      onChange={() => onToggle?.(entry, field)}
    />
  );
}

export default function EntryTable({
  entries,
  editable = false,
  busyId,
  onToggle,
  onDelete,
  onMerge,
}: {
  entries: Entry[];
  editable?: boolean;
  busyId?: string;
  onToggle?: (entry: Entry, field: EntryCheckField) => void;
  onDelete?: (entry: Entry) => void;
  onMerge?: (entry: Entry) => void;
}) {
  if (!entries.length) {
    return (
      <div className="empty-state">
        <strong>まだ登録はありません</strong>
        <span>新しいグループが登録されるとここに表示されます</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="entry-table">
        <thead>
          <tr>
            <th>番号</th>
            <th>登録時刻</th>
            <th>グループ合体</th>
            <th>人数</th>
            <th>マーク</th>
            {checkColumns.map((column) => <th key={column.field}>{column.label}</th>)}
            {editable && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.wentToPlay ? "arrived-row" : ""}>
              <td><b className="number-badge">{entry.number}</b></td>
              <td>{time(entry.createdAt)}</td>
              <td>{entry.merged ? "あり" : "なし"}</td>
              <td><strong>{entry.people}</strong> 人</td>
              <td className="memo-cell">{entry.memo || "なし"}</td>
              {checkColumns.map(({ field }) => (
                <td className="check-cell" key={field}>
                  <CheckCell
                    entry={entry}
                    field={field}
                    editable={editable}
                    disabled={busyId === entry.id}
                    onToggle={onToggle}
                  />
                </td>
              ))}
              {editable && (
                <td><div className="table-actions">
                  <button
                    className="merge-button table-action"
                    disabled={busyId === entry.id || entry.wentToPlay}
                    title={entry.wentToPlay ? "待機中のグループだけ合体できます" : undefined}
                    onClick={() => onMerge?.(entry)}
                  >
                    合体
                  </button>
                  <button
                    className="delete-button table-action"
                    disabled={busyId === entry.id}
                    onClick={() => onDelete?.(entry)}
                  >
                    キャンセル
                  </button>
                </div></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
