"use client";

import { useEffect, useRef } from "react";
import type { Entry } from "@/lib/types";

export default function MergeDialog({
  sourceLabel,
  targets,
  busy,
  onSelect,
  onClose,
}: {
  sourceLabel: string;
  targets: Entry[];
  busy: boolean;
  onSelect: (target: Entry) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="merge-dialog"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={() => { if (!busy) onClose(); }}
    >
      <div className="dialog-heading">
        <div>
          <p className="kicker">MERGE GROUP</p>
          <h2>合体するグループの番号を選んでください</h2>
          <p>{sourceLabel}を、選択した待機中グループへ合体します。</p>
        </div>
        <button className="dialog-close" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      {targets.length ? (
        <div className="merge-targets">
          {targets.map((target) => (
            <button key={target.id} disabled={busy} onClick={() => onSelect(target)}>
              <b>グループ {target.number}</b>
              <span>{target.people}人・{target.memo || "マークなし"}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="dialog-empty">
          <strong>合体できる待機中グループがありません</strong>
          <span>先に通常のグループを登録してください。</span>
        </div>
      )}
      <button className="ghost-button dialog-cancel" disabled={busy} onClick={onClose}>閉じる</button>
    </dialog>
  );
}
