"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import EntryTable from "@/components/EntryTable";
import LogoutButton from "@/components/LogoutButton";
import RoomTabs from "@/components/RoomTabs";
import StatusCards from "@/components/StatusCards";
import type { Entry, EntryCheckField, RoomData, RoomId } from "@/lib/types";

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
      setMessage(`${people}人のグループを登録しました`);
      setMemo("");
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">CHILDREN FESTIVAL 2026</p><h1>受付入力</h1></div>
        <div className="header-actions"><RoomTabs room={room} onChange={setRoom}/><LogoutButton/></div>
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
          <div className="divider"/>
          <label className="field-label">1グループあたりの平均待ち時間</label>
          <div className="inline-setting">
            <input type="number" min="0" max="180" value={wait} onChange={(e) => setWait(Number(e.target.value))}/><span>分</span>
            <button onClick={saveWait}>設定を保存</button>
          </div>
        </section>

        <section className="panel list-panel">
          <div className="panel-heading">
            <div><p className="kicker">LATEST 200</p><h2>{room}教室の受付一覧</h2></div>
            <span className="live-dot">自動更新</span>
          </div>
          <EntryTable entries={data?.entries ?? []} editable busyId={busyId} onToggle={toggle} onDelete={remove}/>
        </section>
      </div>
    </main>
  );
}
