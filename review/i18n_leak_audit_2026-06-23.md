I'll write the action plan directly as my response. No file creation needed since the parent agent reads my text output.

# PchamDB i18n漏れ監査 — 人間が次に動くための行動計画

## サマリ表

| ページ | type | data直書き件数 | JS動的 | severity | 主因 |
|---|---|---|---|---|---|
| battle_simulator.html | app | 90 | あり(6関数群) | **high** | I18N.pokemon/move/ability/item/type を一度も呼ばず全部生ja。ログ40+件 |
| real_battle.html | app | 23 | あり(共有エンジン由来) | **high** | テンプレ直挿入。ログはエンジン側依存 |
| real_battle_simulator.html | app | 27 | あり(391 log呼出) | **high** | 共有エンジン。バトルログ391箇所が最大工数 |
| party_checker.html | app | 10 | あり(技/持ち物セル) | **high** | move/item直書き。runtime APIは既存=置換のみ |
| waza-list.html (waza_picker.js) | app | 8 + UI159 | あり(タグ生成) | **high** | 効果タグ159種ハードコードが最大漏れ源 |
| items_list.html | app | 13 | あり(applyItemI18n誤用) | **high** | applies英語トークン12種+入手列159行 |
| pokemon_db_v9.html | app | 7 | あり(waza-tip) | medium | ホバーtip 1関数のみ。他は配線済 |
| news.html | info | 0 | 設計は模範 | medium | fx_*効果文8件が7言語の辞書未登録 |
| making.html | info | 0(UI 7段落) | なし | medium | 段落地の文7か所が未配線 |
| index.html | app | 0 | なし | low | 「レギュMB」バッジ1件 |
| sitemap.html | info | 0 | なし | low | 見出し+リンク3件 |
| disclaimer.html | info | 0 | なし | low | フッター免責文1件 |
| type_chart.html / how_to_use / db_guide / builder_guide / contact / privacy / terms | — | 0 | なし | none | 配線済(ad-show-btnは英語=漏れでない) |
| *_en.html(7ページ) | legal_static_en | 0 | なし | none | runtime対象外。調査不要 |

**全体像**: 漏れの本体はapp系6ページの**動的JS描画**に集中。固定UI(data-i18n)はほぼ完成済み。`I18N.pokemon/move/ability/item/type` は runtime.js に**既に存在**するのに、シミュレーター系インラインJSが一度も呼んでいないのが構造的な根因。

---

## フェーズ1: データ直書き漏れ(SSOT)— 最優先

方針は news.html の模範に倣う:**生の日本語をHTMLに埋めず、ID(マスター値)を保持したまま描画時のみ `I18N.pokemon/move/ability/item/type` で変換する**。CSSクラス(`t-${t}`, `m-cat ${category}`)はID側なので**そのまま残し、textContentだけ翻訳**。検索照合(`includes`/`toHira`)も内部ja名のまま継続=表示文字列だけ変える。

### 1-A. party_checker.html ★まずここ(最小工数・最大効果)
- 対象: メイン表の技セル(`wazaItemTableHtml`)・持ち物セル・持ち物モーダル
- 具体策: `m.name` → `I18N.move(m.key, m.name)` / `it.name` → `I18N.item(it.name)` / 効果文 → `I18N.itemDesc(it.name)||it.effect`。**runtime.js に全API既存=置換のみ**
- 手間: **S**(置換数行)

### 1-B. pokemon_db_v9.html(waza-tip 1関数)
- 対象: `buildTipHtml()` L4304-4323(技名/タイプ/分類/効果文/習得ポケ名)
- 具体策: 同ファイル他箇所(L2795/L4397)が既に I18N 化済なのでそれに倣う。`w.name`→`I18N.move`、`w.type`→`I18N.type`、`l.name`→`I18N.pokemon`。class/category は新ui-*.jsonキー(db.wt_class_phys 等)。**効果文(w.effect)の多言語データ有無は要ユーザー確認**(保留候補)
- 手間: **M**(語彙キー新設が一部要)

### 1-C. waza_picker.js(waza-list.html / iframe で複数ページが参照)
- 対象: ポケモン選択DD(`renderList`)・タイプ多重選択チェックボックス/title・対象フィルタ動的option
- 具体策: `p.name`→`I18N.pokemon`、タイプラベル/title→`I18N.type(t)`、option→既存 `tTarget`。**同ファイル内の行セルは既にi18nPoke使用=このDDだけ非対称**なので合わせる
- 手間: **M**

### 1-D. items_list.html(属性誤用の修正)
- 対象: applies「対応:」セルの英語ステータストークン12種(damage/physical_attack…)
- 具体策: これらは `data-poke-ja` に入っているため `I18N.pokemon` に渡りpokemon辞書にヒットせず**英語が全言語に露出**。`data-poke-ja`から外し専用キー `data-applies-key` + `I18N.t('items_list.applies.*')` に分離、ui-*.jsonに12訳語登録
- 手間: **M**(HTML12箇所+JS1箇所+辞書)

### 1-E. シミュレーター3兄弟(battle_simulator / real_battle / real_battle_simulator)
最大の塊。**ログ以外の render系を先に**(可視UI・低リスク)、ログは次フェーズ扱い。
- 対象: 各 `render/renderMoves/renderPokeList/renderHandoffBar/renderAbilitySelect/renderItemSelect` のポケモン名/技名/特性名/持ち物名/タイプ/分類
- 具体策: `st.poke.name`→`I18N.pokemon`、`m.name`→`I18N.move(m.key,m.name)`、`a`→`I18N.ability`、`it.name`→`I18N.item`、`t`→`I18N.type`、分類→ui-*.jsonキー(sim.cat_physical等)
- **特記(chips設計バグ)**: battle_simulator の `calcDamage` chips配列が `label` に「いのちのたま」「効果抜群」等の**表示文字列を直格納**していて多言語化不可。**chips を `{labelKey または entityId}` に作り変える**構造変更が必要(置換では済まない)
- 手間: render系=**M/各ページ**、chips構造変更=**L**

### 1-F. 固定語彙の辞書整備(横断・1回やれば全sim共通)
性格名(NATURES/NATURE_LIST)・能力名(STAT_LABELS)・相性ラベル(効果抜群/いまひとつ/×4)・確定数ラベル(確定N発)・状態badge(こんらん/みがわり/ステルスロック等21種)。これらはSSOT列挙に未整備=**ui-*.json か I18N に語彙を足してキー参照化**。real_battle_simulator の `_stageBadges()` 21種・`_STATUS_JA` が代表。
- 手間: **M**(辞書追加 + 各参照点の差し替え)

---

## フェーズ2: 未翻訳UI(data-i18n配線)

固定UI文の配線漏れ。値は既存パターンに合わせ ui-*.json(9言語)へ追加し要素に `data-i18n` 付与。

| 項目 | 対象ページ | 具体策 | 手間 |
|---|---|---|---|
| 段落地の文7か所 | making.html | L253-257/262-265/305-308/354-361/364-367/379-382。内側strongだけ配線済→囲む地の文を `data-i18n-html` でキー化(Week1 descは兄弟と非対称で要修正) | M |
| 「各種情報」h2+リンク2件 | sitemap.html | sitemap.sec_lists / nav.pokemon_list / nav.ability_list | S |
| フッター免責文 | disclaimer.html | disclaimer.footer_disclaimer_body(en版に対訳あり=ja側だけ取り残し) | S |
| 「レギュMB」バッジ | index.html | 日付除く「レギュMB」をキー化(MBはChampions独自コード=固有部は保留可) | S |
| confirm/alert/エラー文 | battle_simulator.html | window.confirm/alert本文を `I18N.t` キー化(5+2件) | S |
| サマリーチップ12 + 入手列159行 | items_list.html | .bar の sum-chip を見出しと同キーで配線。**入手列159行**(不明/フロンティアショップ/シーズン報酬…)を固定句キー化+VP数値補間 | **L**(入手列が最大件数) |
| モーダルタイトル接続詞・側ラベル | battle_simulator / real_battle_simulator | 「〜の持ち物を選択」「自分側/相手側」等を `I18N.t` キー化 | S |
| ヘッダーパンくず/操作ヒント | real_battle_simulator.html | L729/L877 等を data-i18n 配線 | S |

---

## フェーズ3: JS動的生成

### 3-A. waza_picker.js 効果タグ159種 ★最大の動的漏れ源
- 対象: `getMoveFilterTags()` L506-811(約159タグ)+ `CAT_LABEL`(約24)+ホバーポップアップ `bdBadges`(天候/フィールド/状態異常等40)
- 具体策: 全 `text` を `I18N.t(キー, fb)` 化。静的HTMLの `.ef-chip` が既に data-i18n 済なので**同じui-*.jsonキー体系を流用**。常時可視(col-tags列)なので影響大
- 手間: **L**(件数が多い。ただし機械的)

### 3-B. バトルログのテンプレートキー化 ★最大工数
- 対象: real_battle_simulator.html `log()` **391箇所** / battle_simulator.html ログ40+件
- 具体策: msgを文型テンプレ(プレースホルダ `{pokemon}{move}{n}`)化し、埋め込む固有名詞を `I18N.move/ability/type` 経由に。**`pname()` の「相手の」接頭辞も要キー化**
- 連動リスク: `animateStageFromLog()`(L7058)/`lineWithFx`(real_battle L841-921)が**日本語ログ文字列を正規表現マッチ**して演出。ログ多言語化時はこの正規表現も連動修正が必須
- 手間: **L**(391件 + 正規表現連動。設計判断を要するため最後に回す)

### 3-C. 共有エンジン由来(real_battle.html の前提)
- real_battle.html のログ・状態名は**共有エンジン real_battle_simulator.html(`statusJa`/`_STATUS_JA`/`battleLog.push`)由来**で、real_battle.html単体では塞げない。**3-B と一体で対応**(別タスク化が妥当)

---

## 対象外 / 保留(明記)

**対象外(別セッション担当 — 触らない・コミットしない)**
- **コンテンツ生成ページ559系**(content_samples/ ・ability/ move/ pokemon/ type/ 配下)。MEMORY: content-pages-separate-session の通り別セッション管轄
- **pf-iframe / move-picker-iframe 内部の別JSモジュール**(party_checker・battle_simulator が iframe で読む技ピッカー本体)= 当該ページのスコープ外、別途確認

**runtime対象外(意図的ja=漏れでない)**
- `<title>`/meta/OGP/Twitter/JSON-LD/canonical、footer著作権・商標定型文
- HP/能力値/ダメージ/確率%/Lv.50 等の数値、×4・½・⚔・▶・絵文字・●○・♂♀ 等の記号
- 検索照合用の内部ja名(`includes`/`toHira`/lookupキー)、CSSクラス内のja、SVGファイル名エンコード用の name
- `_en.html` 7ページ(legal_static_en・runtime未ロード)。`index_en.html` はリダイレクトスタブ
- ad-show-btn の "Show ad"/"📣 Ad"(英語ハードコード=ja漏れではない。一貫性のみlow)

**Champions独自名(意図的ja例外)**
- 公式外国語名が存在しない新技(ゴールドラッシュ/コインビーム等)・新道具・独自フォーム名(メガ進化等の `p.form`)。news.html は `data-i18n-audit-skip` 付与済。real_battle の独自新技も同様

**ユーザー確認が必要な保留事項**
1. ポケモン `form`(通常/メガ等)の多言語データを I18N.pokemon に吸収するか、専用キーを切るか
2. **技の効果説明文(`w.effect`/`m.effect`)の多言語データの有無** — 無ければ「jaのみ意図的」か「漏れ」かは耳/方針判断。CLAUDE.md北極星(独自ja説明文)との整合も絡む
3. items_database.js のカテゴリ見出し `cats[cat]` を固定UI文キーとするか持ち物メタとするか

---

## 推奨着手順(ROI順)
1. **フェーズ1-A/1-B/1-D**(party_checker / pokemon_db_v9 / items_list applies)= S〜M・APIや前例が既存で即効
2. **フェーズ2の S 案件**(sitemap / disclaimer / index / sim confirm)= 1ファイル数行
3. **フェーズ1-C/1-E/1-F**(waza_picker DD / sim render系 / 固定語彙辞書)= 横断辞書を先に整えてから差し替え
4. **フェーズ3-A**(タグ159)→ **3-B/3-C**(バトルログ391+正規表現連動)= 最後。設計変更とユーザー確認(保留3点)を済ませてから着手

ファイルは全て参照のみで未修正(監査は読み取りタスク)。修正着手時は ui-*.json の9言語1セット差分マージ(MEMORY: i18n-pipeline)を厳守。