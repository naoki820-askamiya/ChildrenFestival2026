# ChildrenFestival2026

214・215教室の受付、来場確認、待ちグループ数、推定待ち時間を管理する短期イベント向けアプリです。

## ローカル起動

1. `.env.example` をコピーして `.env.local` を作成
2. Firebase Admin、Firebase Webアプリ、各ログインパスワードの値を設定
3. `npm run dev` を実行
4. `http://localhost:3000` を開く

## 画面

- `/writer`：受付登録、来場処理、キャンセル、平均待ち時間設定
- `/viewer`：「待ちのみ」「すべて」を切り替えて閲覧
- `/display/214`、`/display/215`：教室前の表示

画面データはFirestoreの変更通知を購読し、受付情報が更新されたときだけ反映されます。

## Firebaseリアルタイム更新の初期設定

1. Firebase Authenticationを開始する
2. FirebaseプロジェクトにWebアプリを登録する
3. 表示されたWebアプリ設定を `.env.local` の `NEXT_PUBLIC_FIREBASE_*` に設定する
4. `firebase login` を実行する
5. `firebase deploy --only firestore:rules` でSecurity Rulesを反映する

本番環境では同じ `NEXT_PUBLIC_FIREBASE_*` をVercelの環境変数にも登録します。クライアントからのFirestore書き込みはSecurity Rulesで禁止し、更新操作はすべて認証済みのNext.js APIを経由します。
