# Standing Picture Controller

ゲームパッドで VTuber 立ち絵をリアルタイム操作する Electron アプリ。  
OBS のウィンドウキャプチャ（透明ウィンドウ）での使用を想定しています。

## 機能

- ゲームパッドで立ち絵を移動・拡縮
- 表情・衣装・キャラクターの切替
- 口パクオーバーレイ（Web Audio API によるマイク音量検出）
- フワフワアニメーション（sin 波）
- 複数キャラクター・衣装・表情スロット対応
- ボタンマップを GUI で自由に変更可能

## 必要環境

- Node.js 18 以上
- Windows 10/11

## セットアップ

```bash
npm install
npm start
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm start` | ビルド＋起動 |
| `npm run dev` | ビルド済みをそのまま起動 |
| `npm run build` | TypeScript コンパイルのみ |
| `npm run dist` | インストーラーをビルド（NSIS） |

## デフォルトボタンマップ（Xbox 系コントローラー）

| ボタン | 機能 |
|---|---|
| A/B/X/Y/LB | 表情 1〜5 |
| RB | フワフワ ON/OFF |
| L3（左スティック押込） | 口パク ON/OFF |
| LT（長押し） | 位置リセット |
| Start | 設定を開く |
| 十字キー左右 | 衣装切替 |
| 十字キー上下 | キャラ切替 |
| 左スティック | 移動 |
| 右スティック | 拡縮 |

ボタンマップは設定画面から変更できます。

## 設定ファイル

実行時の設定は以下に保存されます：

```
C:\Users\<ユーザー名>\AppData\Roaming\standing-picture-controller\config.json
```
