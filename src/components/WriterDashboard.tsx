"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import EntryTable from "@/components/EntryTable";
import LogoutButton from "@/components/LogoutButton";
import MergeDialog from "@/components/MergeDialog";
import MergeWaitingTable from "@/components/MergeWaitingTable";
import RoomTabs from "@/components/RoomTabs";
import StatusCards from "@/components/StatusCards";
import type { Entry, EntryCheckField, MergeWaitingEntry, RoomData, RoomId } from "@/lib/types";

type MergeSource =
  | { kind: "entry"; entry: Entry }
  | { kind: "waiting"; entry: MergeWaitingEntry };

export default function WriterDashboard() {
  const [room, setRoom] = useState<RoomId>("214");
  const [data, setData] = useState<RoomData | null>(null);
  const [merged, setMerged] = useState(false);
  const [people, setPeople] = useState(2);
  const [memo, setMemo] = useState("");
  const [wait, setWait] = useState(5);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [mergeSource, setMergeSource] = useState<MergeSource | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(`/api/rooms/${room}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setData(json);
      setWait(json.waitMinutes);
      setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "読み込めませんでした");
    }
  }, [room]);

  useEffect(() => {
    const initial = setTimeout(() => load(), 0);
    const timer = setInterval(() => load(true), 3000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  async function call(url: string, init: RequestInit) {
    setError("");
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error);
    await load();
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    try {
      await call(`/api/rooms/${room}`, {
        method: "POST",
        body: JSON.stringify({ merged, people, memo }),
      });
      setMessage(merged ? `${people}人をグループ合体待ちに登録しました` : `${people}人のグループを登録しました`);
      setMemo("");
      setMerged(false);
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "登録できませんでした");
    }
  }

  async function toggle(entry: Entry, field: EntryCheckField) {
    setBusyId(entry.id);
    try {
      await call(`/api/rooms/${room}/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ field, checked: !entry[field] }),
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした");
    } finally {
      setBusyId("");
    }
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`受付番号 ${entry.number} をキャンセルしますか？\nこの操作は元に戻せません。`)) return;
    setBusyId(entry.id);
    try {
      await call(`/api/rooms/${room}/entries/${entry.id}`, { method: "DELETE" });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "削除できませんでした");
    } finally {
      setBusyId("");
    }
  }

  async function removeMergeWaiting(entry: MergeWaitingEntry) {
    if (!window.confirm(`${entry.people}人のグループ合体待ちをキャンセルしますか？\nこの操作は元に戻せません。`)) return;
    setBusyId(entry.id);
    try {
      await call(`/api/rooms/${room}/merge-waiting/${entry.id}`, { method: "DELETE" });
      setMessage("グループ合体待ちをキャンセルしました");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "削除できませんでした");
    } finally {
      setBusyId("");
    }
  }

  async function mergeInto(target: Entry) {
    if (!mergeSource) return;
    setBusyId(mergeSource.entry.id);
    try {
      const url = mergeSource.kind === "entry"
        ? `/api/rooms/${room}/entries/${mergeSource.entry.id}`
        : `/api/rooms/${room}/merge-waiting/${mergeSource.entry.id}`;
      await call(url, {
        method: mergeSource.kind === "entry" ? "PUT" : "PATCH",
        body: JSON.stringify({ targetId: target.id }),
      });
      setMessage(`グループ ${target.number} に合体しました`);
      setMergeSource(null);
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "合体できませんでした");
    } finally {
      setBusyId("");
    }
  }

  async function saveWait() {
    try {
      await call(`/api/rooms/${room}`, {
        method: "PATCH",
        body: JSON.stringify({ waitMinutes: wait }),
      });
      setMessage("平均待ち時間を更新しました");
    } catch (settingError) {
      setError(settingError instanceof Error ? settingError.message : "設定できませんでした");
    }
  }

  async function deleteAllData() {
    const confirmed = window.confirm(
      `${room}教室の全データを削除しますか？\n\n受付一覧、グループ合体待ち、待ち時間設定、採番情報がすべて削除されます。\nこの操作は元に戻せません。`,
    );
    if (!confirmed) return;
    setDeletingAll(true);
    setMergeSource(null);
    try {
      await call(`/api/rooms/${room}`, { method: "DELETE" });
      setPeople(2);
      setMemo("");
      setMerged(false);
      setMessage(`${room}教室の全データを削除しました`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "全データを削除できませんでした");
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">CHILDREN FESTIVAL 2026</p><h1>受付入力</h1></div>
        <div className="header-actions"><RoomTabs room={room} onChange={(nextRoom) => { setRoom(nextRoom); setMergeSource(null); }}/><LogoutButton/></div>
      </header>
      <StatusCards data={data}/>
      {error && <div className="notice error-message">{error}</div>}
      {message && <div className="notice success-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}

      <div className="writer-grid">
        <section className="panel registration-panel">
          <div className="panel-heading">
            <div><p className="kicker">NEW GROUP</p><h2>新しいグループを登録</h2></div>
            <span className="room-chip">{room}教室</span>
          </div>
          <form onSubmit={register}>
            <fieldset className="merge-fieldset">
              <legend className="field-label">グループ合体</legend>
              <div className="choice-buttons">
                <button type="button" className={!merged ? "selected" : ""} onClick={() => setMerged(false)}>なし</button>
                <button type="button" className={merged ? "selected" : ""} onClick={() => setMerged(true)}>あり</button>
              </div>
            </fieldset>
            <label className="field-label" htmlFor="people">人数</label>
            <div className="stepper">
              <button type="button" onClick={() => setPeople(Math.max(1, people - 1))}>−</button>
              <input id="people" type="number" min="1" max="99" value={people} onChange={(e) => setPeople(Number(e.target.value))}/>
              <span>人</span>
              <button type="button" onClick={() => setPeople(Math.min(99, people + 1))}>＋</button>
            </div>
            <label className="field-label memo-label" htmlFor="memo">マーク（メモ）</label>
            <input id="memo" type="text" maxLength={100} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：赤い帽子、1-ア"/>
            <button className="primary-button wide">この内容で登録</button>
          </form>
          <div className="danger-zone">
            <p><strong>{room}教室の全データを削除</strong><span>受付を最初からやり直す場合に使用します</span></p>
            <button type="button" className="danger-button" disabled={deletingAll} onClick={deleteAllData}>
              {deletingAll ? "削除中…" : `${room}教室の全データを削除`}
            </button>
          </div>
          <div className="divider"/>
          <label className="field-label">1グループあたりの平均待ち時間</label>
          <div className="inline-setting">
            <input type="number" min="0" max="180" value={wait} onChange={(e) => setWait(Number(e.target.value))}/><span>分</span>
            <button onClick={saveWait}>設定を保存</button>
          </div>
        </section>

        <div className="writer-lists">
          <section className="panel list-panel">
            <div className="panel-heading">
              <div><p className="kicker">LATEST 200</p><h2>{room}教室の受付一覧</h2></div>
              <span className="live-dot">自動更新</span>
            </div>
            <EntryTable
              entries={data?.entries ?? []}
              editable
              busyId={busyId}
              onToggle={toggle}
              onDelete={remove}
              onMerge={(entry) => setMergeSource({ kind: "entry", entry })}
            />
          </section>

          <section className="panel list-panel merge-waiting-panel">
            <div className="panel-heading">
              <div><p className="kicker">MERGE WAITING</p><h2>{room}グループ合体待ち</h2></div>
              <span className="count-chip">{data?.mergeWaitingEntries.length ?? 0}組</span>
            </div>
            <MergeWaitingTable
              entries={data?.mergeWaitingEntries ?? []}
              busyId={busyId}
              onMerge={(entry) => setMergeSource({ kind: "waiting", entry })}
              onDelete={removeMergeWaiting}
            />
          </section>
        </div>
      </div>
      {mergeSource && (
        <MergeDialog
          sourceLabel={mergeSource.kind === "entry" ? `グループ ${mergeSource.entry.number}` : `合体待ちの${mergeSource.entry.people}人`}
          targets={(data?.entries ?? []).filter((entry) => !entry.wentToPlay && (mergeSource.kind !== "entry" || entry.id !== mergeSource.entry.id))}
          busy={busyId === mergeSource.entry.id}
          onSelect={mergeInto}
          onClose={() => { if (!busyId) setMergeSource(null); }}
        />
      )}
    </main>
  );
}
