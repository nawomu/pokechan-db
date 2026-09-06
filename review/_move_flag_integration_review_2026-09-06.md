# 技フラグ schema 統合レビュー

2026-09-06 / 担当 flags_inventory / 読み取り独立レビュー。ソース・生成物の修正なし。本ファイルだけを作成。

## 判定

**今回の生成差分は合格。HEADに存在する値の損失・未説明の内容変更は0件。** 8列の器を整備した段階であり、8列全セルの事実監査完了ではない。今後の根拠投入前に、後述する `set.flags` 丸ごと置換のリスクを処理する必要がある。

`tools/_views_diff.js:47`〜`:49` と`:495`はflags全体を許容対象にしているため、その合格を維持の証明には使用していない。`git show HEAD:master/*.json` と現在のJSONを別のPythonスクリプトで全件比較した。

## 1. builderの呼出順と例外

- `tools/build_master_v2.js:684`: 旧snapshot由来の919行を組み立て・ソートした後、全行へ `initializeMoveFlags`。既存flagsとcontact/protectトップ値を照合し、8項目をboolean|nullへ正規化する。旧値同士が矛盾すればfixを当てる前に停止する設計。
- `:686`〜`:698`: 従来の `_moves_fixes.json` の `set` 適用を保持。現fixesは190件あり、contact/protect/flags設定は0件。既存effects・世代修正などが失われていないことはHEAD比較でも確認した。
- `:699`〜`:701`: 全fix適用後、当該slugのsetを渡して `finalizeMoveFlags`。トップ列だけの旧fixは正典flagsへ反映し、flags.*だけのfixはトップ列へ派生する。両方の同時矛盾、型違反、setが実際には適用されていない場合はthrowする。
- 旧 `try { ... } catch (e) {}` は撤去されており、JSON読み込み・fix適用・schema整合の失敗を空catchで隠さなくなった。新schemaが検出した異常は `write('moves.json', ...)` より前に停止する。
- `:705`〜`:709`のmetaは「既存値の移送は再監査を意味しない」「null=未確認」「別名は未統合」と明記している。内容と実出力が一致している。

`node --check tools/build_master_v2.js` 合格。`node tools/_move_flag_schema_test.js` は11件合格（現在の生成済み919行で再実行）。

## 2. moves.json のHEAD全数比較

| 検査 | 実測 |
|---|---:|
| 件数 | 919 → 919 |
| slug集合・行順 | 完全一致 |
| 旧flagsのキー種類 | 58種類すべて保持 |
| 旧flagsの実セル | 486セル、値の変更・削除0 |
| 新flagsのキー種類 | 65種類（既存contactを含むため+7種類） |
| 8項目の存在・boolean/null型 | 919×8、違反0 |
| トップcontact/protectの旧値保持 | 919×2、違反0 |
| トップcontact/protectとflagsの一致 | 919×2、違反0 |
| 未確認6項目 | 5,514セルすべてnull |
| flags以外の技内容変更 | 0（verified_atを除く） |

新規に追加されたflagsセルは contact796、protect919、substitute_pierce919、reflectable919、metronome_callable919、copyable919、sleep_talk_usable919、instruct_usable919。contactの既存明示123セルもすべて保持している。

数値・名前・説明文・description_legacy・battle_data/effects・世代・タグ・Champions印・source等はすべてHEADと同値。ball/bullet、slash/slicingの別値も保持。`battle_data.substitute_pierce` の既存true値を新flagsへ移植していない。

日時差分はmeta.generated_atと各行verified_at。後者919行の更新元内訳は2026-09-01が729、09-03が181、09-02が8、09-04が1で、すべて09-06へ変わった。これは既存builderの再生成時stampによるもので、今回の事実再監査日を意味しない。

## 3. その他のmaster全数比較

| ファイル | 現件数 | HEADとの差分 |
|---|---:|---|
| abilities.json | 313 | meta.generated_atのみ |
| items.json | 423 | meta.generated_atのみ |
| pokemon.json | 1,273 | meta.generated_atのみ |
| learnsets.json | 1,273 | 日時958箇所のみ（meta1＋verified_at957） |
| regulations.json | 2 | meta.generated_atのみ |
| natures.json | 25 | meta.generated_atのみ |
| types.json | 18 | meta.generated_atのみ |
| _unknowns.json | 4 | generated_atのみ |

learnsetsの内容・行数・行順はHEADと完全一致し、316行への欠落は現在の生成物には残っていない。`reference/_pokeapi_learnsets_raw.json` は本体checkoutの同名ファイルを指す有効なsymlinkで、存在を確認した。`master/_unknowns.json` は従来の4件（うなぎのぼり・はどうのぼうご・ほのおのたてがみ・みつあつめの英語slug未確定）のまま。

再現時の注意: `tools/build_master_v2.js:1022`は当該learnset入力が読めない場合に空配列へフォールバックする旧挙動を残す。今回のschema差分による新規変更ではないが、ignoredコーパスを持たない環境の再生成では件数チェックが必要。

## 4. 未完と追加リスク

### 4.1 根拠付き8項目監査は未完

6項目は全てnullで、contact/protectも旧値の維持にすぎない。Champions/使用可能な最終世代の二重根拠を揃え、セルごとの出典・確認状態を確定する工程が残っている。今回のschema完了を「919技×8セルの事実照合完了」と報告してはいけない。

### 4.2 旧flagsに混入した作業メモの分類・分離は未完

旧58種類は損失回避のため全保持している。以下は今後、用途・実consumer・出典を確認して分類する必要がある。

- 性質の候補: sound/punch/bite/pulse/powder/wind/dance、ball/bullet、slash/slicing。
- 型やメカの付帯情報: z/is_max、charge/recharge、priority、target等。booleanだけでは表せないものを一律消去・変換しない。
- 作業メモの候補: schema_gap、compose_only_fix、new_kind_needed、new_condition_type、vocab_gap、mode_value_unverified、reason、compose_fix_required等。今のflagsと作業台帳の責務を分離する設計は未着手。

別名集合の一致は証明されていないため、ball→bulletやslash→slicingへ機械的に畳んでいない。この保持は適切。

### 4.3 根拠投入前に扱うリスク: flags丸ごと置換

`build_master_v2.js:691`〜`:695`の既存set処理は `set.flags = { ... }` を丸ごと置換する。schemaの `tools/_lib/move_flag_schema.js:42`〜`:54` もroot flags fix自体は許すため、contact/protectを両方含むroot置換なら旧soundや作業メモを失っても停止しない。

読み取りインライン実験で、旧flags `{ sound:true, schema_gap:'memo' }` とcontact/protect=trueを初期化後、`set.flags={contact:true,protect:true}` を適用してfinalizeすると、sound/schema_gapが両方消えた。ファイルは変更していない。

**現fixes190件にflags/contact/protectを設定するものは0件であり、今回の生成物は486旧セル全保持。したがって現在の差分を差し戻す根拠ではない。** ただし今後の全数監査入力は `flags.*` パスへマージする必要がある。root flags置換を拒否するか、旧キー保持を照合する仕組みを追加してから大量投入するのが妥当。

完了範囲: schema配線と現在の生成物維持のレビュー。Web再取得、事実値の適用、builder修正、commit/pushは行っていない。
