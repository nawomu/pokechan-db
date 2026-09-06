# 技の性質フラグ: 既存資産の棚卸し

2026-09-06 / 担当 flags_inventory / 読み取り調査のみ。データ・builder・生成物は変更していない。数値はこの worktree の JSON を Python で全件集計した実測。Web取得なし。

## 結論

既存の値は多数あるが、ヤックン8マスを919技分収録したコーパスは、確認した既存資産にはない。既存を候補・照合材料として再利用し、未確認を false に変換しない。新しい事実の入力は根拠付き `reference/_moves_fixes.json` に集約可能で、現行 builder のパス指定 set が利用できる。`_move_flags.json` を直すだけでは現行 builder に届かない。

## 1. 入力と現行マスター

| 資産 | 実測・スキーマ | 再利用方法・注意 |
|---|---|---|
| `master/moves.json:13` | items 919 / Champions 497。contact 真277・偽642、protect 真669・偽250。flags は全行object、空529 / キー58種 | 比較の旧値。直接編集禁止 |
| `reference/_move_flags.json:1` | slug→object 299件。contact明示123(真116・偽7)、slicing27、bullet26等。型はboolean・string・object・array・number混在 | 299件の全キー値が現masterに包含され、食い違い0。新しい未反映資産ではない。個別source/日時/引用は一律にはない |
| `reference/_authority_flags.json:1` | 日本語技名→17フィールドobject、900件。Wiki本文から抜いた文字列/ null | contact/protect/magic_coat等の二次照合材料。8マスそのものではない。URL・取得日は元コーパスに戻って付ける |
| `reference/_truth_move_flags.json:2` | meta/counts/flag_to_move等。275体×169列=46,475照合、38体欠落、falseなのに習得20件 | ポケモンの習得技列監査。技の性質フラグと無関係 |
| `reference/_flags_audit_showdown.json:2` | 2026-07-02の監査。旧920技中901 joined。8性質=slicing/punch/bite/sound/pulse/bullet/wind/dance | 古い差分候補と対応語彙のみ再利用。現在の網羅性や正典の証明にはならない |
| `reference/_pilot_flags.json:1` | slug→object 6件(growl/supersonic/pyro-ball/victory-dance/bleakwind-storm/psyblade) | 旧パイロット。psyblade は slash:true だが現masterは slicing:true、slash無し。別名をそのまま再適用しない |

現masterの性質フラグ true 数: sound34 / slicing31 / bullet26 / punch24 / wind20 / dance12 / bite10 / powder7 / pulse7。soundキーは35件あり1件はfalseなので、キー数とtrue数を混同しない。contact列とflags.contactの明示123件は矛盾0。二重持ちは将来の分裂リスクであり、現時点の不一致ではない。

別名の実測: slash真21はslicing真31の部分集合。ball真10はbulletと一致せず、mud-shotのみball=trueでbullet無し。他17件はbullet=trueでball真ではない。この差を単純なOR統合で「権威確定」としてはいけない。

## 2. 正典コーパスの所在と再利用

このworktreeに `_authority_corpus/` と `_authority_corpus_ch/` は存在しない。本体checkout `/Users/masamichi/Documents/ポケモンDB/reference/` の下を読み取り確認した。ignored資産なので再開時には所在を確認する。

- `_authority_corpus_ch/moves_ch.json:1`: ヤックン `/ch/move_list.htm`、2026-08-21取得、497行。source/url/fetched_at/fetch_method、各行name/href/type/category/power/accuracy/pp/contact/protect/target/effect。**性質の列はcontact/protectの2つのみ**。noteの「8項目」相当の照合は名前やPP等も含む基本情報で、8マスを収録した意味ではない。
- `_authority_corpus/moves/`: Wiki 900ページ。各JSONのtitle/url/fetched_at/intro/sections/raw_textを保持。例 `はたく.json:2`〜`:5` にURL・取得日・判定表。`_extract_authority_flags.js:18`が入力、`:72`〜`:90`が17フィールド抽出、`:131`が保存。文字列をそのまま保持しているので原文引用へ戻れる。
- 同じWikiコーパスに `ゆびをふる.json` の `sections["ゆびをふるで出る技"]`、`まねっこ.json` の `sections["選ばれる技"]`、`ねごと.json` の `sections["選ばれない技"]`、`さいはい.json` の `sections["さいはいが失敗する技"]` がある。世代表・列挙・例外の二次照合に使える。取得は2026-07-28頃で、Champions対応を一律に証明するものではない。
- `reference/moves_yakkun.json:1` は427 slug→説明文文字列。音技・切る技等の肯定証拠を再利用できるが、言及無しを否定証拠にはしない。

Wiki技名の単純一致はmasterの910行。NFKCを両側に適用すると918行に一致し、残りは `クモのす`（Wiki側の別表記）。名前だけで主キー化するとZ技の物理/特殊18ペアを潰すため、出力主キーはslugのまま保つ(`build_master_v2.js:617`)。

## 3. ヤックン8マスと既存語彙

元の依頼定義は本体 `HANDOFF_SESSION_2026_09_04.md:45` と `HANDOFF_SESSION_2026_09_05.md:24`。候補名は既存案を記載し、実際のセル見出し・○×の極性は取得時に検証する。

| ヤックン項目 | 統合先の候補 | 現状・混同禁止 |
|---|---|---|
| 接触 | flags.contact | 現在はトップレベルcontact全919行＋flags内123行 |
| まもる | flags.protect | 現在はトップレベルprotect全919行。true=守られる側の性質 |
| みがわり | flags.substitute_pierce | battle_data.substitute_pierce=trueが22行。セルの○×が「防ぐ」か「貫通」か確認し、必要なら反転。音技等の一般則だけで全行確定しない |
| マジックコート | flags.reflectable | Wiki magic_coatが候補。現在専用フラグ無し |
| ゆびをふる | flags.metronome_callable | 現在専用フラグ無し。持ち物メトロノームと別 |
| まねっこ | flags.copyable | 現在専用フラグ無し。Wiki mirror_moveはオウムがえしであり、まねっこへ転用禁止 |
| ねごと | flags.sleep_talk_usable | 現在専用フラグ無し。「その技をねごとが呼べる」ことで、技自体が眠っていて使える性質とは別 |
| さいはい | flags.instruct_usable | 現在専用フラグ無し。技の適格性と実行時の対象/PP/履歴条件を分ける |

音/パンチ/噛む/切る/弾/波動/風/踊り/粉は、これら8マスとは別の性質。58キーには `schema_gap`、`compose_only_fix`、`new_kind_needed` 等の作業メモも混入している。全キーをboolean化したり、作業メモを証拠なしに削除したりしない。

## 4. 消費箇所と未確認値の落とし穴

- `tools/build_master_v2.js:40`〜`:43`: 凍結snapshotを入力。`:658`〜`:659`でcontact/protect、`:674`でflagsを採用。flagsは `ch.flags || nat.flags` なので空objectのChampions側が全国側を隠し得る。現行実測で `_move_flags.json` の取りこぼしは0。
- 同 `:680`〜`:696`: `_moves_fixes.json` の `set` は `flags.contact` 等のパスを更新できる。flagsは既に全行objectなので途中作成を要しない。フィールドごとの根拠・明示unknownの保存先は親の設計で決める。
- `tools/build_views.js:172` / `:219`: `!!m.contact` はnull→false、`:173` / `:220` は `m.protect !== false` でnull→true。未知の値をこのまま流すと既知のboolへ化ける。現masterはcontact/protect欠損0だが、新設列には同じ変換を使わない。
- `tools/build_national_view.js:309`〜`:310` は別の旧生成経路でflags.contact優先。一方、現行build_viewsはトップレベル優先。移行はこの違いも検証する。
- sim `real_battle_simulator.html:1683`〜`:1685`、`:1870`、`:1890`、`:1900`、`:1905` が性質を消費。bullet/ball、slicing/slashのOR互換がある。`:2024` / `:2148` の接触判定は `contact===true || isPhys` なので明示falseの物理技でも接触扱いし得る。**今回の棚卸しではエンジン修正しない**。
- sim `:3368` はさいはいNGをeffect kindで近似、`:3380`以降はよこどり専用リスト。よこどりは8マスに含まれない。`:3889`はsubstitute_pierce/sound等を参照。現在の使用可否ロジックと、新しい事実フラグの値を同一視しない。
- compose `tools/_waza_compose.js:1094` / `:1110` がsubstitute_pierceとsoundを説明文へ反映する。データの移動だけで説明文が変わらないことを比較する必要がある。
- 旧 `tools/_apply_built_effects.js:16` は既存flagsを丸ごと置換し、`:26`で旧生成器を動かす。現行ルートでは再利用不可。

Wiki抽出表の未確認例: magic_coatはnull15・世代付き文字列16、protectはnull1・単純○×以外7、contactは単純○/◯/×以外2。`_extract_authority_flags.js:50`〜`:51` は単純記号のみboolとみなす。これを雑なtruthinessで読むと「×」や世代注記もtrueになる。

## 5. 省エネでの具体的な再利用手順

1. 919 slugの台帳に既存値・根拠候補・確認状態を列挙。旧flagsは候補として全保存し、作業メモと真の性質を分類。false/unknown/対象外は別状態として扱う。
2. ヤックン8マスの見出し・極性・世代を少数ページで確認してから取得。Champions497件を優先し、他422件は最後に使えた世代を記録。既存moves_chのcontact/protectは再取得結果との全数比較に使う。
3. Wikiの上記4つの集約節を一度だけ構造化し、世代表/除外表から候補を作る。個別900ページは矛盾・例外だけ開く。mirror_move→copyableの誤変換を禁止する。
4. 一致セルだけ根拠つきで `_moves_fixes.json` の既存slugへマージする。未確定の行を残して再開できるよう、未処理一覧と原文証拠を別台帳に保持する。_move_flags.jsonやsnapshotを再度入力正本にしない。
5. flagsを正規の事実表にした後、互換のcontact/protect/旧別名が必要な消費箇所には同じ確定値から生成する。旧列削除は配線確認後。変更→build_master_v2→build_views→全数差分→guards→実機。説明文/effects/エンジンの意味変化を混ぜず、事実の矛盾は別に解消する。

完了: 棚卸しのみ。親が実装・最終検証を担当。本ファイル以外の変更、commit/push、外部メッセージ送信なし。
