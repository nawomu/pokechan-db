# 2026-09-07 Claude Fable: ダブルバトル設計(B064)の調査反映 + D0(設計判断に依存しない部分)

**状態: 一旦停止(2026-09-07 19:30 阿部さん指示「一旦終了でメモしといて」)。すべて未コミット・push なし。エンジン(`real_battle_simulator.html`)・master・生成物は無変更。**

## 0. 次に開いたら最初にやること(順番どおり)

1. **阿部さんの🙋4への返事を確認する**(§3)。返事が無ければ **D1以降に進まない**(設計判断が要る)。
2. 返事が来たら → §4「commit する束」を1コミットで入れる(日本語メッセージ・trailer 付き)→ D0残り(台帳01凍結)→ D1(`review/_b064_staged_plan_2026-09-06.md` 段D1=行動者契約と純粋scheduler)を Sonnet へ・Fable が検証。
3. **⚠️ Supabase の不通(§5)は返事と無関係に確認が要る**(阿部さんの手で)。

## 1. 今日やったこと(時系列)

### 昼(〜14:20・設計)
- 設計書 **`設計_ダブルバトル_2026-09-07.md`**(372行・未コミット)= 調査WF(17エージェント・`review/_doubles_research_2026-09-07/` 00=104件/01=37件/T1〜T8+verify)を全反映。
- 矛盾5件 → 阿部さん指示「実機の前にまずネットで調べる」→ 日本Wiki本文で **4件決着**:
  ①複数対象の処理順=**位置順(味方→相手左→右)** ②壁は受け手1体でも **2/3**(第五世代以降・形式キー) ③ひらいしん2体=**素の素早さ**(ランク/TR無視) ④のろい(ゴースト)=**相手ランダム・対象選択なし**。⑤使用者が途中でひんし=出典なし → Showdown既定順(全対象ダメージ→対象別反応)を採用・`continueAfterUserFaint` を台帳に保持。
- 阿部さん提供の Champions ダブル実機スクショ4枚を **`02_実機画面の観察_2026-09-07.md`** に転記(画像はディスクに無い)。**選出=4体で確定**(台帳#15 決着)。未観測=「技を選んだ直後にだれをねらうか」画面(台帳#22・D5前まで不要)。
- 阿部さん向け説明ページ(artifact): **https://claude.ai/code/artifact/1c0dd64f-5ba4-421e-8e86-d12a8f1fb905** (「ダブルバトル設計の芯」・ブラウザで開いてある)。
- セッション枠93%で停止 → 18:04 に cron で再開。

### 夜(18:04〜19:25・D0 分岐(3)=設計判断に依存しない部分だけ)
成果はすべて **`review/_b064_d0_2026-09-07/`**(未コミット)。実装=Sonnet 3本・検証=Fable(数字は私が master/エンジンで再計算して一致を確認)。

| 成果 | 中身 | 検証 |
|---|---|---|
| `00_シングル基準_実測.md` + `logs/` | HEAD `3531731d` で7本実測 → **全緑**: `_sim_test` 825/0(段120クラッシュ再発なし)・`_sim_sweep_all` 919/0・`_sim_hard_interaction` 174/0 skip11・`_sim_behavior_all` 605/605 flag0・`_mc_engine_check` 19/0・`_lab_verify_v2` 32/32・`_lab_adversarial` **10/10** | S9 だけ最初 9/10 で赤 → 原因=9/3 案B(56cce70d)以降メガシンカに種族ストーン必須なのに `freshBattle` が持ち物を付けない=**テスト側の未追随**。`tools/_lab_adversarial_test.js` s9 に `S.itemsList()` から種族ストーンを持たせる修正(エンジン無変更)→ 10/10(`logs/_lab_adversarial_test_after_fix.log`) |
| `01_依存表.md` | 実行入口/状態/通信/undo/RNG(file:line 付き)。`sides={self,opp}` 固定名で1側1体(`.active` 0件)・`sides.self` 25/`sides.opp` 29/`['self','opp']` 23/`Math.random` 44(グローバル差替が唯一の決定論点)・ターン番号はエンジン外(各ページ)・undo=`sides` 約60項目の手書きコピーで `env` 対象外(lab が補完) | grep 再計算で一致。🙋6件は末尾(§3-B) |
| `mirror/README.md` + **新規 `tools/_online_mirror_test.js`** | 2ブラウザ鏡写しテストの作り直し(旧 `scratchpad/e2e_online.js` は git 履歴にも無し)。`node tools/_online_mirror_test.js --turns=3 --port=8010`。exit 0=一致/1=不一致/2=SKIP。設計=Supabase Realtime(broadcast+presence)・ロックステップ(ホスト発行 seed で `Math.random` 差替)・`onlineConnectRoom`/`setSlot`/`confirmPick`/`onlineSubmitAction` を直接呼ぶ | `node --check` OK・exit コード分岐確認。**実行は SKIP(§5)**=本比較ロジックは未実データ検証 |
| `02_ダブル関連技_抽出.md/.json`(台帳#34) | target語彙13種(1体選択674/自分96/相手全体60/自分以外全体20/全体の場20/味方の場12/味方全体10/不定9/ランダム1体6/相手の場4/全体4/味方1体3/自分か味方1)。A=target欄 134技(Ch72)・B=`flags.double_battle_oriented` 8・C=`effects[].target∈{ally,team,party}` 38(Ch20)・**A∪B∪C=152(Ch83)**。取りこぼし7技(ワイドガード/ファストガード/てだすけ/ドラゴンエール/いのちのしずく/じばそうさ/とおぼえ)は**全部 A と C で拾える**(B だけだと 6/7 落ちる)。特性12件は master/abilities_ch 両方に在(Ch true 7)。master/abilities.json に味方/誘導の構造欄は無く事実表は `reference/_ability_facts.json`(288特性)。**印なしギャップ=テレパシー(facts 不在)・いかく**=D3 で事実表に足す候補(確定扱いしない) | master で再計算し語彙・7技の target/effects 一致 |

## 2. 未コミットの変更一覧(git status)

- 新規: `設計_ダブルバトル_2026-09-07.md` / `review/_doubles_research_2026-09-07/`(全部) / `review/_b064_d0_2026-09-07/`(全部) / `tools/_online_mirror_test.js` / 本書
- 変更: `tools/_lab_adversarial_test.js`(S9 修正・要commit) / `次回ここから.md`(冒頭ブロック2つ)
- 変更(副作用・悪化ではない・commit 可): `review/sim_test_report.html`(生成日時のみ) / `reference/_sim_behavior_result.json`(tested 606→605・ok 同数・flag0=7月以降の技数差)
- **commit しない**: `reference/_official_news_snapshot.json`(タイムスタンプのみ)

## 3. 🙋 阿部さんに確認してほしいこと

### A. 設計の4点(artifact に説明あり・返事が来るまで D1 に進まない)
1. **芯3つ**でよいか: 側×枠(`sides[side].slots[slot]`・シングル=1枠のダブル)/ `target_lock`(6段: 候補→誘導→すじがねいり→倒れたら選び直し→範囲×0.75は使用時に数える→位置順)/ 4体を1列で並べる scheduler(優先度→素早さ→タイ・行動ごとに並べ直し)。
2. **入口A**(1つの入口で形式ボタン・シングル3体/ダブル4体固定・チームビルダー共通。「6見せて4選ぶ」はオンライン時に後で足す)でよいか。B(別ページ)は却下案。
3. **D2(シングルを新契約へ接続)で一度報告**でよいか(そこまでは Sonnet 実装・Fable 検証で自走)。
4. **`no_ally_target`**(味方を選べない技の印)=(a) 今は足さない(Champions 497技に該当なし)でよいか。

### B. D0 で出た確認事項(D1 着手時に Fable が処理する前提でよいか)
- `slotId` という名前が `battle_lab.html`/`real_battle_simulator.html:9538` で別の意味に既に使われている → 設計側の名前を変える案(`pos`/`slotKey`)。
- `decideOrder` の直接の呼び出し行が未特定(runTurn 6961〜7898 内に展開の可能性)。
- `canonSides()` の `real_battle_simulator.html:7467` での用途・`__rbCanonFirst` がオフラインでも走るか。
- 依存表の件数は延べ数(D1 で行単位ユニーク化)。
- 鏡写しテストの本比較ロジックが未検証(Supabase 復旧後に必ず1回通す)。

## 4. 返事が来たら commit する束(1コミット・日本語メッセージ)

`設計_ダブルバトル_2026-09-07.md` + `review/_doubles_research_2026-09-07/` + `review/_b064_d0_2026-09-07/` + `tools/_online_mirror_test.js` + `tools/_lab_adversarial_test.js` + `review/sim_test_report.html` + `reference/_sim_behavior_result.json` + `次回ここから.md` + 本書。
メッセージ案: `docs: ダブルバトル設計(B064)=調査反映・矛盾4件を日本Wikiで決着・選出4体確定 + D0(シングル基準7本全緑/依存表/鏡写しテスト作り直し/台帳#34抽出)。S9はテスト側を案Bに追随。エンジン無変更`
trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_014NAn2c9PQDbiPqJoBVaJ5B`

## 5. ⚠️ 本番オンライン対戦が不通の可能性(返事と無関係に確認)

- `online/supabase-config.js` の **`yznayflwjbxcstfkzqnv.supabase.co` が DNS NXDOMAIN**(Sonnet が nslookup+Google DoH で確認、Fable も nslookup/curl で独立確認・19:00)。無料枠プロジェクトの一時停止/削除の可能性。
- 影響: `online_battle.html` は接続前から websocket が `ERR_NAME_NOT_RESOLVED` で失敗=合言葉ルーム/ロビーが動かない可能性が高い。
- **Supabase ダッシュボード(nawomu プロジェクト)の確認・復旧は阿部さんの手で**(Claude はアカウント/認証に触らない)。復旧 or 新プロジェクトに変えたら `online/supabase-config.js` の url/anon キーを差し替え → `node tools/_online_mirror_test.js --turns=3 --port=8010` を通す。

## 6. その他の宿題(今日の作業と無関係・前回から持ち越し)

- 9/9 10:59 JST **M-B→M-C 切替**: `reference/_regulations.json` の role を next→current に書換・前の現行を消す → build → ゲート → push(手順=`公式情報の探し方_レギュ更新手順_2026-09-03.md`)。
- AdSense 再審査・Search Console(404 18件対応済み)の結果待ち。`making.html:356` の古い記述。
- cron の一回発火ジョブ(18:04)は発火済み・残っていない。**無人の `claude --continue` 自動再起動は禁止**のまま。

## 7. 参照(このセッションの規律)
- 順番=①データ一本化 ②ページ ③バトル(ダブルのみ B064 で凍結解除・**設計が先・エンジンコードは D1 まで書かない**)。
- 憲法 `設計_バトルエンジン原理_2026-07-26.md` §11-D/E「困ったらフェーズを足す。まとめない」。ダブル専用のコピーエンジン/DBは作らない。
- 事実は権威(日本Wiki+徹底攻略/ヤックン`/ch/`)の二重一致で確定。Showdown は差分オラクル(既知差分は台帳01 §3)。
