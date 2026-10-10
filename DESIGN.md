---
version: alpha
name: schale-calc
description: ブルーアーカイブの計算結果を読むための静的サイトの意匠。暗色はSumi、明色はKinari。
colors:
  primary: "#9a6a00"
  accent: "#9a6a00"
  accent-subtle: "rgba(154, 106, 0, 0.10)"
  surface: "#faf6ef"
  surface-raised: "#fffdf8"
  on-surface: "#3a2f28"
  muted: "#6f6257"
  border: "#e3d9c9"
  link: "#14506e"
typography:
  title:
    fontFamily: system-ui
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: system-ui
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.2
  caption:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 8px
  full: 9999px
spacing:
  sp-1: 4px
  sp-2: 8px
  sp-3: 12px
  sp-4: 16px
  sp-5: 24px
---

# schale-calc

## Overview

計算結果を、プログラムを書かないプレイヤーが読むための静的なページ群である。
各ページは結論と数値を先に置き、前提・手順・検証を後に続ける。操作部品はリンクと開閉だけとする。
共通デザイン原本（rust-svelte-templateのDESIGN.md、2026-10-10参照）のSumi familyを、読み物のページへ適用した。

## Colors

暗色はSumi、明色はKinariとし、OSの `prefers-color-scheme` に従う。手動の切り替えと保存は持たない。

| 役割 | Kinari | Sumi |
|---|---|---|
| surface | #faf6ef | #191919 |
| surface-raised | #fffdf8 | #232323 |
| on-surface | #3a2f28 | #e6e6e6 |
| muted | #6f6257 | #9a9a9a |
| border | #e3d9c9 | #333333 |
| accent | #9a6a00 | #e0a800 |
| accent-subtle | rgba(154,106,0,.10) | rgba(224,168,0,.15) |
| link | #14506e | #7fdbff |

アクセントは、現在のページの印、節見出しの左線、結論や最多の値の強調、フォーカスに使う。
強調した値は太字や「最多」などの文字でも示し、色だけに頼らない。
グラフのデータ色は各計算のページが用途とともに定める。

## Typography

書体はsystem-uiとし、Webフォントを足さない。frontmatterの5役割を使う。
本文は16px、表の補足と注記は14px以下のmutedとする。数値の列は等幅数字（tabular-nums）で右揃えにする。

## Layout

- 新しく作る読み物のページ（一覧、計算の報告）は、中央寄せで最大720pxの1列とし、ページの縦スクロールで読む。
  左右の余白は合わせて24px、上下は狭幅16px・広幅24pxとする。ブレークポイントは768px。
- グラフや広い表を持つページ（gacha）は最大1100pxを使う。
- 内容はカード（surface-raised、1pxのborder、角丸8px、内側16px、狭幅12px）に節ごとに入れる。
  節見出しは17pxで、左に4pxのaccentの線を引く。
- 表は幅320pxで横にはみ出さない列数にする。列が多くなる表は行と列を入れ替える。
  平均と誤差のような組は、値の下に小さいmutedの行で添える。
- 補足として読めば足りる表（盤面の一覧など）は既定で閉じた開閉に入れる。
- 共通のstyleは `assets/site.css` が持つ。gachaの各ページは生成スクリプト内のstyleを使う。

## Components

- ナビゲーションはページ上部の下線付きのリンク列とし、現在地に `aria-current` と2pxのaccentの下線を付ける。
- 一覧のリンクは、名前と1行の説明を組にして並べる。GitHubで開くリンクはその旨を注記する。
- バッジは角丸9999pxで、accent-subtleの地にaccentの文字を置く。
- フォーカスは2pxのaccentの輪郭と2pxの間隔で示す。

## Verification

ChromiumとPlaywrightで、明暗それぞれ、幅375pxと1280pxで各ページを開き、
ページの横はみ出しが0pxであること、表と本文が読めることを確かめる。
