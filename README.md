# ChatGPT Markdown Exporter

ChatGPT の現在開いている会話だけを Markdown (`.md`) としてローカル保存する、Kan 用のプライバシー重視 Chrome 拡張です。

## 方針

- 外部送信なし: ページ内 DOM から抽出し、Blob download でローカル保存します。
- 権限最小化: Chrome permissions は空です。対象ホストは `chatgpt.com` と `chat.openai.com` のみです。
- 現在のセッション限定: ChatGPT で開いている会話ページだけを対象にします。
- 古い会話対応: エクスポート前に上方向へ自動スクロールし、未読み込みターンの読み込みを待ちます。

## 開発

```bash
npm install
npm run check
```

## ローカルで使う

```bash
npm run build
```

1. Chrome で `chrome://extensions/` を開く
2. Developer mode を ON
3. **Load unpacked** からこのリポジトリの `dist/` を選ぶ
4. ChatGPT の会話ページを開く
5. 右端の `MD Export` タブ → `この会話を .md 保存`

## 実装メモ

- `src/content.ts`: ChatGPT ページへ右サイドタブを注入し、エクスポートを実行
- `src/lib/scroll.ts`: 会話の上端まで自動スクロールし、追加読み込みが落ち着くまで待つ
- `src/lib/extract.ts`: ChatGPT の DOM から user / assistant ターンを抽出
- `src/lib/markdown.ts`: Markdown 生成とファイル名サニタイズ

## 既知の制約

ChatGPT 側の DOM 変更には追従が必要です。DOM が変わって抽出できなくなった場合は、`tests/extract.test.ts` に新しい実DOM断片のフィクスチャを追加してから修正してください。
