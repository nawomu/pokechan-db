# ②ページ作り変え(pokedb.js 1本化)棚卸し W10(2026-09-04)

調査専用レポート。**既存ファイルは一切変更していない**(grep/読解のみ)。
対象は CLAUDE.md「★★★★全体の順番」の②(`pokedb.js` へ向け替え)。①(データSSOT一本化)は
`master/*.json` + `tools/build_views.js` で概ね完了済み(2026-09-01〜)。③(バトル再作り直し)は凍結中。

隣接する監査として、同日に別ラインで **`review/_page_data_audit_r2_2026-09-04.md`**(B-4 2周目・
ページ由来データの「独自データ/オーファン生成器」監査)と **`reference/_page_ledger.json`**(番人
`tools/_page_guard_test.js` の許可台帳)が存在する。今回の調査はこれらと**重複しない**ように、
①で棚卸し済みの独自データ(`ABILITY_TYPE_IMMUNITY`/`NATURES_ARR`/`LEGACY_FORM_NAME`)は結論だけ引用し、
**pokedb.js 移行に必要なフィールド対応**に絞って掘り下げた。

---

## 0. 大前提の訂正: `items_db_all_v2.html` は既に移行完了していた

任務メモは「items_db_all_v2.html(items_database.js を併読している理由を確認)」としていたが、実際に読むと
**`items_database.js` を一切読んでいない**。

```
items_db_all_v2.html:137: <script src="pokedb.js?v=20260903c" data-files="items,regulations"></script>
items_db_all_v2.html:215: var master = PokeDB.items();
items_db_all_v2.html:363: PokeDB.setMode('all');
items_db_all_v2.html:364: PokeDB.ready.then(function () { ... });
```

`git log --oneline -- items_db_all_v2.html` → `6d3fcd46 feat(B-3): 持ち物masterを「全世代の持てる道具」に広げ
(423件)、全国どうぐ一覧の新版 items_db_all_v2.html を pokedb.js 1枚で作る`。つまりこのページは
**②のパイロットが実質すでに1本終わっている**。加えてもう1本、`ability_all.html`(旧
`ability_all_v2.html` が昇格・旧版は `reference/_legacy_pages/ability_all_legacy_20260904.html` へ退避)も
`pokedb.js` 1枚読みで完成済み:

```
ability_all.html:140: <script src="pokedb.js?v=20260903c"></script>
ability_all.html:203-224: PokeDB.allPokemon() / PokeDB.allAbilities() で逆引きマップ構築
ability_all.html:389-390: PokeDB.setMode('all'); PokeDB.ready.then(function(){ ... });
```

→ この2本が**移行の実例テンプレ**になる(§7で使い方をまとめる)。今回棚卸しした残り10ページは
まだこのパターンに乗っていない。

---

## 1. `pokedb.js` の現状(2026-09-03 全面改稿版)の提供範囲

`pokedb.js:1-242` を読解。データは1バイトも持たない薄いローダで、`master/*.json` を fetch し
`PokeDB.ready`(Promise)完了後に以下を提供:

| API | 返す物 | 対応する master |
|---|---|---|
| `allPokemon()` / `pokemon(key)` | `master/pokemon.json` の `items`(絞り込み後) | 直接 |
| `allMoves()` (slug→技の辞書) / `move(key)`(slugまたはja名) | `master/moves.json` の `items` | 直接 |
| `movePriority(mv)` | `mv.priority` | 直接 |
| `learners(moveName)` | `master/learnsets.json` から技名→ポケモン名の逆引き(**mode を見ずに全件から作る**=下記§4bで指摘) | 派生(pokedb.js内で数え上げ) |
| `abilityDesc(name)` / `allAbilities()` / `ability(key)` | `master/abilities.json` | 直接 |
| `learnset(name)` / `confiscated(name)` | `master/learnsets.json` の `learn`/`confiscated`(**ja名の配列**。slug配列ではない) | 直接 |
| `items()` | `master/items.json` | 直接 |
| `natures()` | `master/natures.json` の `items`(配列。`{name,up,down}[]`) | 直接 |
| `types()` | `master/types.json` の `items[].name` の配列 | 直接 |
| `typeColor(name)` | `master/types.json` の `items[].color` | 直接 |
| `typeChart()` / `typeEffectiveness(atk, defTypes)` | `master/types.json` `meta.tables.TYPE_CHART` | 直接(2026-09-03 a380b67bで新設) |
| `regulation()` / `regulationNext()` / `regulations()` | `master/regulations.json` | 直接 |
| `raw(name)` | 指定ファイルの生JSON全体 | 検査用 |
| `setMode('champions'|'all')` | 絞り込み条件の切替(データは1本のまま) | — |
| `healthCheck()` | 自己診断 | — |

`master/types.json` の `meta.tables` には実は **`TYPE_KANJI`/`TYPE_DISPLAY`/`TYPE_OFFENSIVE_STATS`/
`DEFAULT_TYPE_ORDER`/`TYPE_CHART`** の5表がすでに入っている(`master/types.json` 実物を読解して確認)が、
`pokedb.js` がアクセサを持つのは `TYPE_CHART` だけ。残り4つは **データはmasterに在るのにpokedb.jsに窓口が無い**
(§8のギャップ①)。

---

## 2. 生成物(pokechan_data.js / pokechan_data_all.js / items_database.js)の実際のグローバルとフィールド

`pokechan_data.js` 冒頭コメント(1-2行目)で確認: これは**もう `tools/build_views.js` の生成物**
(2026-09-01の段D/E完了済み・旧手書き版は `reference/_legacy_snapshot/` に凍結済み)。ページから見ると
「生成物を直接読んでいる」ことに変わりはないが、**データの出どころ自体はすでにmaster 1本**になっている。
今回の②移行は「生成物を経由せず `pokedb.js` を直接読む」への置き換え。

生成される定数(`pokechan_data.js`/`pokechan_data_all.js` 共通。`tools/build_views.js:617,650` の
export リストで確認):

```
TYPES, TYPE_COLORS, TYPE_KANJI, TYPE_DISPLAY, TYPE_OFFENSIVE_STATS, DEFAULT_TYPE_ORDER,
TYPE_CHART, POKEMON_LIST, DATA(=POKEMON_LIST の別名), WAZA_MAP, POKEMON_WAZA, ABILITY_DESC,
STAT_RANK, NATURES, REGULATIONS(全国版のみ; Champions版のトップレベルには無いが REGULATIONS 自体は
両ファイルとも定義されている。pokemon_db_all_v9.html は REGULATIONS を使っていない=季列なし)
```

### 2-1. `POKEMON_LIST` / `DATA`(pokemon.json 由来)

`tools/build_views.js:270-296`(`baseRow`)+`:317-343`(`buildPokemonChampions`)を読解。

| 生成物のフィールド | master.pokemon の対応 | pokedb.js での取得 | 備考 |
|---|---|---|---|
| `no,name,display_name,form,mega,genderless,gender_female_pct,weight_kg,type1,type2,hp,atk,def,spatk,spdef,spd,total,ab1,ab2,ab3,resist` | 同名 | `PokeDB.pokemon(name)` / `PokeDB.allPokemon()` の各要素にそのまま存在 | **フィールド名は完全一致**。gapなし |
| `gen`(全国版のみ) | `p.gen` | 同上 | 一致 |
| `season`(配列。全国版=master.seasons、Champions版はR4対応で `season: p.seasons.slice()` を追加済み・`build_views.js:334-336`) | `p.seasons` | 同上(フィールド名の違い: 生成物`season`単数 vs master`seasons`複数) | **名前が違う**(要注意。§8ギャップ②) |
| `cnt4,cnt2,cnt1,cnthf,cntqf,cnt0,cnt42,cnthfqf` | 無し(`resist`配列から`resistCounts()`で都度計算・`build_views.js:299-311`) | 無し | **pokedb.jsに窓口なし**。ただし `pokemon_db_v9.html:1560-1575` は実際には**自前で再計算している**(後述)ので実害は小さい |
| `added_in`(Champions版のみ) | `p.champions_added_in` | `PokeDB.pokemon(name).champions_added_in`(raw fieldとして直接存在) | フィールド名リネーム(`added_in`←`champions_added_in`)だけ。gapなし |
| 169技分の bool 列(`amaeru`,`mamoru`,…) | 無し(`reference/_legacy_champions_move_flag_keys.json` の固定キー一覧×learnsetから都度算出・`build_views.js:35,323-329`) | 無し | §4-c参照。**現行10ページのどれも読んでいない**(grep確認済み・使用箇所ゼロ)。移行の障害にはならない |

### 2-2. `WAZA_MAP`(moves.json 由来)

`tools/build_views.js:182-262` を読解。全国版は `slug` キー、Champions版は `champions_key` キー
(**キーの種類が違う**)。

| 生成物のフィールド | master.moves の対応 | pokedb.js | 備考 |
|---|---|---|---|
| `name,move_no,type,category,target,power,accuracy,pp,contact,protect,description,description_legacy,battle_data,flags,tags,subcategory,availability` | 同名 | `PokeDB.move(key)` が返す raw オブジェクトにそのまま存在 | 一致 |
| `priority`(全国版のみ・`m.priority||0`) | `m.priority` | `PokeDB.movePriority(mv)` | 一致(Champions版WAZA_MAPには`priority`列が無い=呼び出し側は`0`扱いになっていた旧仕様。要確認) |
| `key`(全国版=`m.slug` / Champions版=`m.champions_key`) | `m.slug` / `m.champions_key` | `PokeDB.move()`は**slugかja名でしか引けない**。`champions_key`では引けない | **gap**(§8③) |
| `learners`(配列。全国版=全ポケモンから、Champions版=Championsポケモンだけから数え上げ・`build_views.js:135-179`) | 無し(派生) | `PokeDB.learners(name)` | `PokeDB.learners()`は**modeを見ずに全件から数える**(`pokedb.js:118-127`のbuildIndexはmode分岐なし)。Champions版ページに使うと**全国版のポケモンまで含めて過剰カウントする**。**gap**(§8④・実害あり) |
| `national_new`(全国版のみ・`!m.champions && !!m.description`) | 派生 | 無し | 呼び出し側で `!m.champions` から1行で再現可能。gap扱い不要 |
| `added`/`mode`(Champions版のみ・`m.champions_added`/`m.champions_mode`) | 同名フィールドがmasterに直接存在 | `PokeDB.move(key).champions_added` 等でそのまま取れる | フィールド名リネームのみ。gapなし |
| `is_max`/`z`(条件付き。`m.flags.is_max`/`m.flags.z`) | `m.flags` に同居 | `PokeDB.move(key).flags` | gapなし(トップレベルへの昇格をしていないだけ) |

### 2-3. `POKEMON_WAZA`(逆引き: ポケモン名→技**キー**配列)

`tools/build_views.js:347-370`(未読部分だが export 一覧と使用箇所から機能を確認)。中身は
「そのポケモンの覚える技の `key`(全国版=slug/Champions版=champions_key)一覧」。

対応する pokedb.js API は無い。`PokeDB.learnset(name)` は **技の日本語名の配列**(`master/learnsets.json`
の `learn` フィールドそのまま。実際に確認: `フシギバナ.learn[0]='ギガインパクト'`)を返すため、
「キー配列」が欲しいページは `name→slug` 変換を自分で行う必要がある(`PokeDB.move(name).slug` で1件ずつ
引けば作れる・データ追加は不要)。**gap軽微**(§8⑤)。

### 2-4. `ABILITY_DESC` / `STAT_RANK` / `NATURES` / `REGULATIONS`

- `ABILITY_DESC`(名前→効果文の辞書) = `PokeDB.abilityDesc(name)` と**完全に同じ実装**(`pokedb.js:108-109`
  の `IDX.abilityDesc` 構築と `build_views.js` の `buildAbilityDescNational/Champions` は同じ
  `effect_ja`参照)。gapなし。
- `STAT_RANK`(`{name}` または `{name}({form})` キー→ 実数値・全国内順位の辞書。`tools/build_views.js:402-431`
  で**全ポケモンの種族値から百分位ランクを計算**する派生データ)。**pokedb.jsに対応する物が無い**。
  計算式自体は単純(配列をソートして同順位を許容するランク付け)なので、ページ側で
  `PokeDB.allPokemon()` から同じロジックを再実装すれば作れるが、**現状は「1回計算してJSONに焼く」設計**。
  pokedb.js は「薄いローダ」原則(データを持たない)なので、ここに計算ロジックを足すかどうかは設計判断が要る。
  **gap(要判断・§8⑥・🙋あり)**。
- `NATURES`(生成物: `{性格名: {up,down}}` の辞書) vs `PokeDB.natures()`(`{name,up,down}[]` の配列)。
  **形が違う**(辞書 vs 配列)。ページ側で `reduce` すれば1行で変換可能。gap軽微(§8⑦)。
- `REGULATIONS`(生成物: `[{id,role,start_jst,end_jst}]`) vs `PokeDB.regulations()`(`master/regulations.json`
  の `items` そのまま=`{id,name,role,current,status,start_jst,end_jst,note,sources,verified_at}[]`)。
  **PokeDB版の方がフィールドが多い(上位互換)**。gapなし、むしろ良化。

---

## 3. `items_database.js`(旧・独立アイテムマスター)のフィールド差分

`party_checker.html:896` が読んでいる `items_database.js` は**SSOT化前の独立ファイル**
(`window.ITEMS_DATABASE = {version,updated,context,sources,categories,items,stats,regulations,mega_rules}`)。
`items` は**181件**(Champions実装状況ベース。master/items.json は423件=全世代)。

実物比較(`こだわりハチマキ` で突き合わせ):

| items_database.js の `items[]` フィールド | master.items の対応 | 差分 |
|---|---|---|
| `key` | `slug` | リネームのみ |
| `name`, `name_en`, `category`, `restriction`, `notes`, `verify`, `q12`, `factor`, `source_q12`, `pokeapi_slug`, `applies_to`, `season` | 同名で存在 | 一致 |
| `effect` | `effect_house`(**`effect_ja`ではなくhouse版と一致**。実際に文字列を突き合わせ済み) | リネームのみ |
| `implemented_in_pokechan` | `implemented` | リネームのみ |
| — | `boosts,champions,regulation,pokeapi_id,names(9言語),cost,fling_power,gen_introduced,category_pokeapi,pocket,effect_en,flavor_ja,flavor_en` | master側にしか無い(items_database.js生成時点にはまだ無かった追加フィールド。2026-09-01のSSOT広げ後) |
| トップレベル `categories`(カテゴリ→キー配列の逆引き) | 無し(masterにこの形の索引は無い) | `party_checker.html:1017-1023` の実装を読むと**実際にはこの `categories` を使わず、`items` を category フィールドで自前グルーピングし直している**(`party_checker.html:1017-1023`)。つまり**この索引自体が死んでいる**=移行の障害にならない |
| トップレベル `stats`(件数サマリ) | 無し | ページからの参照なし(grep 0件)。移行不要 |
| トップレベル `regulations`(現行/次の2枠) | `master/regulations.json` と**内容重複**(値も一致) | `party_checker.html` からの参照なし(grep 0件)。**単なる死んだ重複データ**。移行時に自然消滅する |
| トップレベル `mega_rules`(文言4行) | 無し | grep 0件(未参照)。移行不要 |

→ `party_checker.html` が実際に触っているのは `it.key/name/category/effect` の4つだけ(`ITEM_BY_KEY`構築
=`party_checker.html:982-985`、モーダル一覧=`:1017-1023`)。**`PokeDB.items()` + フィールド名の
軽いアダプタ(`key←slug`, `effect←effect_house`, `implemented_in_pokechan←implemented`)だけで完全に代替可能**。
items_db_all_v2.html が既に証明済みのパターンと同じ。

---

## 4. ページ別調査

各ページ、①読んでいる生成物とフィールド ②PokeDB対応/gap ③同期→非同期の影響箇所 ④i18n現状
⑤独自データ ⑥難易度・共有部品、の順。

### 4-1. `damage_calc.html`(難易度: 中・ただし特殊事情あり)

- **script**: `damage_calc.html:41` `pokechan_data.js` / `:42` `sprite_api_ids.js`。加えて
  **`damage_calc.html:352` に `<iframe id="engine-frame" src="real_battle_simulator.html?v=20260729a" style="display:none">`**
  があり、ダメージ計算の実処理は自前で書かず**`real_battle_simulator.html`(③凍結中のバトルエンジン)を
  隠しiframeで読み込んで `contentWindow.__sim` を叩いている**(`damage_calc.html:400-412`)。
- **使用フィールド**: 自身のトップレベルscriptで直接触るのは `WAZA_MAP`(:425,426,574,592,593)・
  `POKEMON_LIST`(:453)・`TYPE_COLORS`(:462,686,721)だけ(検索一覧UI用)。実際の**ダメージ計算式・
  能力値計算・特性/持ち物の効果適用は全て `S`(=iframe内の`__sim`)任せ**(`onAtkPokeChange`等で
  `S.pokeByName`,`S.natureList()` 等を呼んでいる。`damage_calc.html:454,464,489,498,401`等)。
- **PokeDB対応**: `WAZA_MAP`→`PokeDB.allMoves()`、`POKEMON_LIST`→`PokeDB.allPokemon()`、
  `TYPE_COLORS`→`PokeDB.typeColor()`。ここだけ見れば直接対応があり**gapなし**。
  ただし**`__sim`ブリッジ側(=real_battle_simulator.html)は今回のスコープ外(③凍結)で、
  そちらは今も`pokechan_data.js`/`items_database.js`直読み(§6参照)のまま**。→ **damage_calc.html の
  検索UI部分だけ pokedb.js に向け替えても、計算結果の元データ(iframe側)は別の口から読んだまま**になり、
  理屈上は同じmasterに行き着く(iframeも結局pokechan_data.js経由でmaster由来)ので値は揃うが、
  **「1枚だけ読む」というR1の理念には反する状態が残る**(2つの読み込み経路が同じページに同居)。
  ③解禁までは許容せざるを得ない構造的制約として明記しておく。
- **同期→非同期**: `damage_calc.html:453` `POKEMON_LIST`直接参照は関数内(`renderList`)なので実害小。
  ただし `onEngineReady()`(:493-)は「iframeのload + `w.__sim`のpolling」で駆動しており、
  **iframe側の準備を待つ設計は既にある**。`PokeDB.ready`を同じ場所に一段追加するだけで済みそう
  (構造的には移行しやすい部類)。
- **i18n**: `I18N.*` 14箇所・`data-i18n` 61箇所。`tPokeName/tAbilityName/tMoveName/tItemName/tTypeName`等の
  ヘルパーが揃っており(`damage_calc.html:360-366`)配線は良好。
- **独自データ**: `BATTLE_ONLY_FORMS`(`damage_calc.html:394`。変身専用フォーム矯正リスト)は
  他ページ(speed_compare/suggest_lite/suggest_partner)にも**同じSetがコピペで存在**(§5)。
- **共有可能部品**: `buildPokeSearch()`(ポケモン検索ウィジェット)は suggest系と酷似したUIで
  共通化候補。

### 4-2. `speed_compare.html`(難易度: 小)

- **script**: `speed_compare.html:14` `pokechan_data.js` / `:15` `sprite_api_ids.js`。
- **使用フィールド**: `POKEMON_LIST`(:439 のみ・一度きり)・`p.spd/p.type1/p.type2/p.mega/p.name`。
  `TYPE_COLORS`(:430)。持ち物・特性は一切参照せず、こだわりスカーフ/おいかぜ/まひは
  **ハードコードした倍率(×1.5/×2/×0.5・`speed_compare.html:292,384`のコメント)**で処理。
- **PokeDB対応**: `POKEMON_LIST`→`PokeDB.allPokemon()`、`TYPE_COLORS`→`PokeDB.typeColor()`。
  gapなし(10ページ中もっとも単純)。
- **同期→非同期**: `speed_compare.html:439` `var ALL = (typeof POKEMON_LIST !== 'undefined') ?
  POKEMON_LIST.slice() : [];` が **IIFE直下(トップレベル)** で実行される(`speed_compare.html:369`
  `(function(){ ... })()` の中だが、`init()`関数の外)。`pokedb.js`は`fetch`ベースで非同期なので、
  ここを`PokeDB.ready.then(function(){ ALL = PokeDB.allPokemon(); init(); })`のように
  **initの起点ごと`.then()`の中へ移す**必要がある。`init()`自体は既に`DOMContentLoaded`待ち
  (`speed_compare.html:764`)なので、`DOMContentLoaded`と`PokeDB.ready`の両方を待つ形に直すだけで済む
  (構造変更は小さい)。
- **i18n**: `I18N.*` 5箇所・`data-i18n` 49箇所。`t/tPokeName/tTypeName`ヘルパーあり(:406-408)。
- **独自データ**: `BATTLE_ONLY_FORMS`(実体は無いがコメントに「suggest_partner.html作法」の流用と明記
  =他ページからのコピペ体質そのものはここにも存在)。`EFFORT_MAX_PER_STAT=32`等の定数は
  `real_battle.html`/`real_battle_simulator.html`の値を**コメントで出典明記の上、意図的に手打ちで
  同期**させている(`speed_compare.html:376-384`)。値そのものの二重管理ではあるが、①②の順番的には
  「バトルエンジン側の値が変わったらここも直す」という運用上の負債であって、masterに項目が無いための
  gapではない。
- **共有可能部品**: `calcStat`/`rankMult`(実数値計算)は damage_calc.html にも欲しい共通ロジック。

### 4-3. `suggest_lite.html` / `suggest_partner.html`(難易度: 小〜中・ほぼ同型)

- **script**: 両方とも `pokechan_data.js` + `sprite_api_ids.js`(`suggest_lite.html:14-15`,
  `suggest_partner.html:14-15`)。`suggest_lite.html:298`のコメントに
  「resist配列使用（suggest_partner.html:319-350 の流用）」と明記されており、**suggest_lite は
  suggest_partner のロジックを複製して作られている**(コード上の兄弟関係が確認できる)。
- **使用フィールド**: `POKEMON_LIST`・`TYPES`・`TYPE_COLORS`・`p.resist`(18要素配列。タイプ相性の
  複合積を事前計算済み。masterの`pokemon.items[].resist`そのもの)・`p.total`・`p.type1/type2`・`p.mega`。
  `suggest_partner.html:317`にTYPE_CHARTへの言及があるが**コメントのみで実コードは`p.resist`を使用**
  (TYPE_CHARTを叩いて自前合成はしていない)。
- **PokeDB対応**: `POKEMON_LIST`→`PokeDB.allPokemon()`(`.resist`フィールドはmasterのpokemon項目に
  そのまま含まれる。実測: `master/pokemon.json`の`items[].resist`確認済み)。`TYPES`→`PokeDB.types()`。
  `TYPE_COLORS`→`PokeDB.typeColor()`。gapなし。
- **同期→非同期**: `suggest_lite.html:263-268`(`suggest_partner.html:273-279`と同型)。
  ```
  suggest_lite.html:263: var BATTLE_ONLY_FORMS = new Set([...]);
  suggest_lite.html:264: function isPickable(p){...}
  suggest_lite.html:266: var POOL = [];
  suggest_lite.html:267: if (typeof POKEMON_LIST !== 'undefined'){ POOL = POKEMON_LIST.filter(isPickable); }
  ```
  **トップレベル(関数外)で`POOL`を構築**しており、`speed_compare.html`と全く同じ非同期対応が必要。
  加えて`suggest_lite.html:258-261`のコメントに重要な**既知の地雷**が明記されている:
  > 「TYPES / TYPE_COLORS / POKEMON_LIST / SPRITE_API_ID は…グローバルconst。これらを
  > `var`で再宣言するとホイスティングでグローバルをシャドーイングして表示が全滅する
  > （2026-07-16の実例）ので、絶対に再宣言せず裸の識別子で参照する。」
  → **pokedb.js移行後は`POKEMON_LIST`という裸の識別子自体が無くなり`PokeDB.allPokemon()`という
  関数呼びに変わるため、このクラスの事故は構造的に起きなくなる**(移行のポジティブな副効用として
  明記に値する)。ただし新たに「`PokeDB.ready`を待たずに`PokeDB.allPokemon()`を呼んで空配列を
  掴んでしまう」という**別種の事故**に置き換わるので、初期化順の管理は別途必要。
- **i18n**: 両方とも `I18N.*` 3箇所・`data-i18n` 19〜26箇所(damage_calc/speed_compareより少ない=
  値の大半をJSで動的に組み立てているため。ヘルパー関数自体は用意されている)。
- **独自データ**: `BATTLE_ONLY_FORMS`(両ページに実体コピー。`damage_calc.html`/`speed_compare.html`と
  合わせて**同じSetリテラルが4ページに分散**=移行時にpokedb.js側の共通ヘルパー化を検討する価値あり)。
- **共有可能部品**: 弱点集計ロジック(`weaknessCounts`)がほぼ完全一致(`suggest_lite.html`側コメントが
  「suggest_partner.html:319-350 の流用」と自己申告)。1本の共通jsに切り出せる。

### 4-4. `waza-list.html` / `waza-list_v2.html` / `waza-list_all.html`(難易度: 中〜大・実処理は外部js)

- **script**: 3ページとも本体ロジックはページ内スクリプトではなく外部ファイル。
  - `waza-list.html:429-430`: `pokechan_data.js` + `waza_picker.js?v=20260904a`
  - `waza-list_v2.html:418-419`: `pokechan_data.js` + `waza_picker_v2.js?v=20260618c`
  - `waza-list_all.html:451-452`: `pokechan_data_all.js` + `waza_picker.js?v=20260904a`
  （`waza-list.html`と`waza-list_all.html`は**同じ`waza_picker.js`を共有**し、データファイルだけ
  Champions版/全国版で出し分けている。`waza-list_v2.html`だけ別の`waza_picker_v2.js`=枝分かれ)。
  `waza_picker.js`は**今日9/4 10:00にも別件(B-4 i18n監査)でコミットされている**(`git log --oneline -- waza_picker.js`
  = `3f101d86`)。**活発に触られているファイル**、今回は読解のみ。
  3ページとも `<link rel="canonical">`/`og:url`が揃って`https://pchamdb.com/waza-list.html`を指しており
  (`waza-list.html:18`,`waza-list_v2.html:18`,`waza-list_all.html:18`)、`waza-list.html`が本番の正典URLで
  `_v2`/`_all`は非canonical(重複コンテンツ扱いを避ける設定)。
- **使用フィールド**(`waza_picker.js`実測): `WAZA_MAP`の`.type/.category/.power/.accuracy/.pp/.priority/
  .target/.contact/.protect/.name/.key/.learners/.subcategory/.availability/.description_legacy/.tags/
  .battle_data/.flags`(`waza_picker.js:69-81,101-104,342-399,588-593`ほか多数)。`POKEMON_LIST`は
  `_pokeTotal`集計(:89)と学習ポケモン一覧の並べ替え(:1792,1808)用途。
- **PokeDB対応**: フィールド単位ではmaster.movesと完全一致(§2-2参照)。ただし2つの**実質的なgap**:
  1. **全国版キー=slug、Champions版キー=champions_key**。`PokeDB.move(key)`はslug/ja名でしか引けず
     champions_keyでは引けない(`pokedb.js:169`)。`waza-list.html`(Championsモード)を移行するには
     pokedb.js側に`champions_key`索引を追加するか、ページ側で`PokeDB.allMoves()`を舐めて
     `champions_key`→技オブジェクトの対応表を都度作る必要がある。
  2. **`PokeDB.learners()`はmodeを見ない**(§2-2)。`waza-list.html`のChampions版で技の使い手一覧を
     出すと、全国版のポケモンまで混入する。**実際のバグになりうる**箇所。
- **既知の地雷(移行と直接関係ないが要記録)**: `waza_picker.js:90-95` の `_extractPriority(desc)` は
  **技の優先度を`m.priority`フィールドから読まず、`description`文中の「優先度:N」という文字列を
  正規表現で抜き出して算出している**(`w.effect = m.description`を経由・`waza_picker.js:77,104`)。
  masterには`priority`という数値フィールドが最初から存在する(§2-2表)ため、これは**説明文の言い回しが
  変わると静かに壊れる自己参照的な実装**。pokedb.js移行のタイミングで`PokeDB.movePriority(mv)`に
  置き換える方が安全(ただし今回は指摘のみ・修正はスコープ外)。
- **同期→非同期**: `waza_picker.js:11`(ファイル冒頭)で`POKEMON_LIST`と`WAZA_MAP`をいきなり参照、
  `:61-84`で`WAZA_MASTER_BUILT`をトップレベルIIFEとして即時構築、`:89`で`_pokeTotal`も即時構築——
  **ファイル全体が「読み込まれた瞬間にWAZA_MAP/POKEMON_LISTが存在する」前提**で書かれている
  (`<script src="waza_picker.js">`が`pokechan_data.js`より後に同期ロードされることに依存)。
  pokedb.js化するには、この初期化ブロック一式を`PokeDB.ready.then()`の中に丸ごと移し、
  `waza-list.html`側のUI初期化(現状はDOMContentLoaded起点か要確認)ともタイミングを合わせる必要があり、
  **3ページの中で最も作り替えが大きい**(10ページ中でも`pokemon_db_v9`系に次ぐ規模)。
- **i18n**: `waza-list.html`本体は`I18N.*` 0(`data-i18n`180)、実処理は`waza_picker.js`側
  (`I18N.*` 26箇所)。`waza-list_v2.html`は`waza_picker_v2.js`側`I18N.*` 18箇所。概ね配線済み。
- **独自データ**: 番人台帳(`reference/_page_ledger.json`)には waza-list系3ページの独自fact-table登録は無し
  (=このファイル群自体に事実の表の直書きは見つかっていない、というのが2026-09-04時点の監査結果)。
- **共有部品**: `waza_picker.js`と`waza_picker_v2.js`は**別物として並存**しており、統合するか
  `waza_picker_v2.js`を廃止するかは阿部さん判断が必要(§9)。

### 4-5. `pokemon_db_v9.html` / `pokemon_db_all_v9.html`(難易度: 大・最重量ページ)

- **script**: `pokemon_db_v9.html:1365` `pokechan_data.js` / `pokemon_db_all_v9.html:1350` `pokechan_data_all.js`。
  本体ロジックは4本の`<script>`ブロック(:1366,2160,3083,3347)に分散、4829行(all版は4785行)。
- **両ファイルの差分は驚くほど小さい**: `diff`したグローバル定数使用一覧の差は`REGULATIONS`
  (全国版は季カラムを持たないので不使用)のみ、トップレベル関数定義の差は`_getPmHoverRevIdx`1個のみ。
  **実質的に同一コードの二重管理**(4800行がほぼ丸ごと複製)。これはまさにCLAUDE.mdが警告する
  「ページが増えるたびにチェックをやり直す」の実例そのもの。**pokedb.jsへの移行は、この2ファイルを
  `PokeDB.setMode('champions'|'all')`で出し分ける1本に統合する好機**(§9で提案)。
- **使用フィールド**: ほぼ全種(`TYPE_COLORS,WAZA_MAP,TYPE_KANJI,TYPES,DATA,REGULATIONS,STAT_RANK,
  ABILITY_DESC,POKEMON_LIST,POKEMON_WAZA`)。`pokemon_db_v9.html`内でのヒット数だけで100箇所超
  (§実測: grep一覧の合計約115件)。
- **PokeDB対応/gap**:
  - `TYPE_KANJI`(`pokemon_db_v9.html:1519`1箇所)→ **pokedb.jsにアクセサ無し**(§8①のgap)。
    データ自体は`master/types.json` `meta.tables.TYPE_KANJI`に既存。
  - `STAT_RANK`(:2514,2516)→ §2-4のgap(要判断)。
  - `ABILITY_DESC`(:2589,2592)→ `PokeDB.abilityDesc()`で完全代替可(gapなし)。
  - `REGULATIONS`(:2259,2261)→ `PokeDB.regulation()/regulationNext()/regulations()`で代替可
    (むしろ情報量が増える。gapなし)。
  - `cnt4/cnt2/...`の再計算(:1560-1575 `recalcResistCounts(p)`)は**自前で`p.resist`から算出**しており
    生成物側の`cnt*`列を読んでいない。**gap扱い不要**(pokedb.jsのpokemon()に`resist`さえ入っていれば
    このページは困らない=既に入っている)。
  - `POKEMON_WAZA`(:4162-4166,4300-4301等)→ §2-3のgap(軽微・変換で代替可)。
  - `ADDED_WAZA_KEYS`(:4288)は`WAZA_MASTER.filter(w=>w.added)`から**都度計算**(独自データではなく派生)。
  - `MEGA_CAPABLE_NOS`(:4156-4158)も`DATA.forEach`から**都度計算**(独自データではない)。
- **番人台帳に既出の独自データ**: `ABILITY_TYPE_IMMUNITY`(`pokemon_db_v9.html:1580-1584`、
  `pokemon_db_all_v9.html`にも同一表)。「特性→タイプ無効化」の事実の表(ふゆう→じめん無効、
  ちょすい→みず無効)で、`reference/_page_ledger.json`の`allow_fact_table`に**2026-09-04付で登録済み**
  =masterに正式収録してよいか阿部さん判断待ち(設計_特性の扱い_2026-08-16.mdの「事実の表」第1号候補)。
  **今回新たに見つけたものではなく、既存の判断待ち事項として引用するに留める**。
- **同期→非同期**: 最重量。トップレベルで即時実行される処理が多数:
  - `pokemon_db_v9.html:1378` `const WAZA_MASTER = ...`(WAZA_MAPから即時変換)
  - `pokemon_db_v9.html:4156-4158` `MEGA_CAPABLE_NOS`即時構築
  - `pokemon_db_v9.html:4288` `ADDED_WAZA_KEYS`即時構築(`WAZA_MASTER`に依存)
  - `pokemon_db_v9.html:1560-` 以降の`recalcResistCounts`等はDATA全件初期化ループの一部(関数定義自体は
    トップレベルだが呼び出しタイミングは要追跡)
  これらを`PokeDB.ready.then()`一箇所にまとめて入れ替える設計が必要。行数が多いため
  **書き換え自体よりも「どこまでがinit実行で、どこからが単なる関数定義か」の仕分けに調査コストがかかる**
  (今回の棚卸しでは全箇所を1行ずつは追い切れていない。移行着手時に改めて`init()`の呼び出し木を
  洗い出す作業が要る)。
- **i18n**: `I18N.*` 30/29箇所、`data-i18n` 81箇所。ヘルパー(`_tDB`等)は整備済み(:2517)。
- **共有可能部品**: `waza-list-template.html`をfetchしてBlobURLに変換する`buildWazaListBlobUrl`
  (`pokemon_db_v9.html:4296-`)は独立した仕組みとして切り出しやすい。

### 4-6. `party_checker.html`(難易度: 大・最も広いフィールドカバレッジ)

- **script**: `party_checker.html:895-896` `pokechan_data.js` + `items_database.js`。
- **使用フィールド**: 調査対象10ページ中もっとも網羅的。`ITEMS_DATABASE,NATURES,STAT_RANK,TYPES,
  DEFAULT_TYPE_ORDER,POKEMON_LIST,TYPE_COLORS,POKEMON_WAZA,WAZA_MAP,ABILITY_DESC,TYPE_OFFENSIVE_STATS,
  TYPE_DISPLAY`の12種類すべてに触れている(実測ヒット数=約50箇所)。
- **`ITEMS_DATABASE`の使用箇所を精査**(§3参照): 実際に触っているのは`it.key/name/category/effect`の
  4フィールドのみ(`party_checker.html:982-985`の`ITEM_BY_KEY`構築、`:1017-1023`のモーダル一覧)。
  トップレベルの`categories`索引は**使わず自前で作り直している**(:1017-1020の`byCat`)ため死んでいる。
  → **`PokeDB.items()` + `key←slug`,`effect←effect_house`のアダプタで完全代替可能**(items_db_all_v2.html
  で実証済みのパターンをそのまま使える)。
- **`NATURES`使用箇所**(`party_checker.html:1066-1588`に多数): `Object.keys(NATURES)`で性格名一覧を作る
  (:1067)ほか、`NATURES[name].up/.down`の直接参照。`PokeDB.natures()`は配列形式なので、
  `PokeDB.natures().reduce((o,n)=>(o[n.name]={up:n.up,down:n.down},o),{})`の1行変換で代替可能。gap軽微。
- **`STAT_RANK`使用箇所**(:1166,1880,1906,1910,2096): `pokemon_db_v9.html`と同じ用途(実数値のランク表示)。
  §2-4のgap(要判断)がここにも波及。
- **`TYPE_OFFENSIVE_STATS`使用箇所**(:2282): タイプ別「ばつぐん/いまひとつ/無効」の技数バッジ表示
  (`party_checker.html:2282-2287`)。`master/types.json` `meta.tables.TYPE_OFFENSIVE_STATS`に実データは
  存在するが**pokedb.jsにアクセサが無い**(§8①のgapに含まれる)。
- **`TYPE_DISPLAY`使用箇所**(:910,915): タイプ名の短縮表示ラベル。同じく`meta.tables`にはあるが
  pokedb.js未対応(§8①)。
- **`DEFAULT_TYPE_ORDER`使用箇所**(:1606,1677,1833): タイプ表示順の既定値(ユーザーがドラッグで並べ替え
  可能・localStorageに保存)。同上、`meta.tables`にはあるがpokedb.js未対応(§8①)。
- **同期→非同期**: `party_checker.html:1606-1607`
  ```
  let typeOrder = (() => { ... return [...DEFAULT_TYPE_ORDER]; })();
  ```
  トップレベルIIFEで即時評価。`NATURE_NAMES = Object.keys(NATURES)`(:1067)も同様にトップレベル。
  他ページ同様、`PokeDB.ready.then()`へ移す作業が必要。**12種類のグローバルすべてがトップレベル+
  複数関数から散発的に参照されており**、移行時の書き換え範囲がページ内で最も広い。
- **i18n**: `I18N.*` 26箇所・`data-i18n` 75箇所。`_tCK`ヘルパー多数使用(整備は良好)。
- **番人台帳に既出の独自データ**: 特になし(`party_checker.html`は`allow_fact_table`に未登録=
  独自fact-table直書きは無いという2026-09-04監査結果)。ただし`reference/_page_data_audit_r2_2026-09-04.md`
  の項目12に**「`party_checker.html`は`pokechan_data.js`の`NATURES`をそのまま使っており重複していない
  ことを確認(誤って重複扱いしないよう明記)」**という既存の注記があり、今回の調査結果とも整合する。
- **共有可能部品**: アイテム選択モーダル(`_renderItemModalList`)は`battle_simulator.html`/
  `battle_lab.html`の持ち物選択UIと機能が近く、pokedb.js移行後に共通化候補。

---

## 5. バトル系(③凍結中・移行対象外)のエンジン読み込み1節

指示どおり短くまとめる。

| ページ | エンジン本体のスクリプト | データ読み込み |
|---|---|---|
| `real_battle.html` | インライン`<script>`(`real_battle.html:10`で`pokechan_data.js`直読み) | 常にChampions固定(`data=all`を付けない設計。`real_battle_simulator.html:989`のコメントで確認) |
| `real_battle_simulator.html` | インライン`<script>`(モード切替ローダーを内蔵) | `real_battle_simulator.html:988-999`で`document.write()`により`pokechan_data.js`または`pokechan_data_all.js`を動的選択(`?data=all`クエリで分岐)。加えて`:1001`で`items_database.js`を常時読み込み |
| `online_battle.html` | インライン`<script>`(`online_battle.html:10`で`pokechan_data.js`直読み) | Championsのみ(real_battle.htmlと同型) |
| `battle_lab.html` | インライン`<script>`(`battle_lab.html:11-34`にモード切替ローダー) | `battle_lab.html:11-34`で`localStorage(rb_lab_data_mode)`+URLクエリからモードを決め、`document.write()`で`pokechan_data.js`または`pokechan_data_all.js`を選択後、`battle_log_i18n.js`/`sprite_api_ids.js`/`preset_builds.js`/`move_fx_map.js`/`battle_fx_cues.js`/`fx_primitives.js`を順に読み込む |
| `battle_simulator.html` | インライン`<script>`(`battle_simulator.html:868-869`で直読み) | `pokechan_data.js` + `items_database.js`を固定読み込み(モード切替なし=Champions専用ページ) |
| `fx_editor.html` | インライン`<script>`(`fx_editor.html:13`で直読み) | `pokechan_data.js`固定(演出プレビュー用にポケモン/技名が要るだけ) |

いずれも`reference/_page_ledger.json`の`allow_direct`に登録済み(既知債務・③解禁まで凍結)。
`damage_calc.html`(§4-1)が`real_battle_simulator.html`をiframeで抱え込んでいる関係上、
**damage_calc.htmlの完全なpokedb.js化は、実質的にreal_battle_simulator.html側(③)の
移行と無関係ではいられない**(検索UI部分だけなら独立して移行可能、という条件付きの結論)。

---

## 6. (a) master/pokedb.js を広げる必要がある項目 — 総リスト(重複を畳んだもの)

| # | 項目 | 現状 | 対応案 | 優先度 |
|---|---|---|---|---|
| ① | `TYPE_KANJI`/`TYPE_DISPLAY`/`TYPE_OFFENSIVE_STATS`/`DEFAULT_TYPE_ORDER`のアクセサ | データは`master/types.json` `meta.tables`に**既存**。pokedb.jsに窓口が無いだけ | `pokedb.js`に`typeKanji()`/`typeDisplay()`/`typeOffensiveStats()`/`defaultTypeOrder()`を追加(`typeChart()`と全く同じパターンで機械的に作れる。**最も簡単で効果が大きいgap**) | 高(着手コスト最小) |
| ② | Champions版ポケモンの`season`(単数)と master の`seasons`(複数)のフィールド名不一致 | `build_views.js:334`で変換済みだが、pokedb.jsの生オブジェクトは`seasons`のまま | ページ側で`p.seasons`を読むよう統一すれば実は問題なし(生成物側の`season`という別名が要らない子)。**masterを広げる必要はなく呼び出し側の参照名を直すだけ** | 低 |
| ③ | `WAZA_MAP`のChampions版キー(`champions_key`)でmoveを引けない | `PokeDB.move(key)`はslug/ja名のみ対応(`pokedb.js:169`) | `pokedb.js`のbuildIndexに`IDX.moveByChampKey`を追加し、`move(key)`のフォールバック順に加える(`IDX.moveBySlug[key] \|\| IDX.moveByChampKey[key] \|\| IDX.moveByName[key]`) | 高(waza-list.html移行の前提条件) |
| ④ | `PokeDB.learners()`が`setMode()`を見ずに全件から数える | `pokedb.js:118-127`のbuildIndexはmode非依存で1回だけ計算 | `learners()`呼び出し時に現在の`mode`を見て、Championsモードなら`allPokemon()`(絞り込み済み)に含まれる名前だけへ絞り込むフィルタを追加(データの再取得は不要・関数内で1行フィルタを足すだけ) | 高(waza-list.htmlのChampions版で実際に不正確な結果を返しうる) |
| ⑤ | `POKEMON_WAZA`(ポケモン名→技**キー**配列)相当の窓口が無い | `PokeDB.learnset(name)`は技の**名前**配列のみ | 呼び出し側で`PokeDB.learnset(name).map(n => PokeDB.move(n).slug)`により1行で作れる(データ追加不要)。pokedb.js側に`learnsetKeys(name)`という薄いヘルパーを足すと呼び出し側が楽になる程度の話 | 中 |
| ⑥ | `STAT_RANK`(種族値の全国内百分位ランク)相当の窓口が無い | `build_views.js:402-431`で1回計算してJSONに焼いている派生データ | (a)pokedb.js側に`statRank()`計算ロジックを追加する(薄いローダ原則からは逸脱)か、(b)`master/pokemon.json`側に事前計算済みで持たせる(生成時計算は既存踏襲だがmaster自体に持たせるのは新しい判断)か、(c)ページ側で`PokeDB.allPokemon()`を都度ソートして自前計算するか。**設計判断が要る(🙋)** | 中(判断待ち) |
| ⑦ | `NATURES`が配列(pokedb.js)と辞書(生成物)で形が違う | `PokeDB.natures()`は`{name,up,down}[]` | ページ側で`reduce`して辞書化(1行)。pokedb.js側に`natureByName()`のようなヘルパーを足せば呼び出し側がさらに楽 | 低 |
| ⑧ | `ITEMS_DATABASE`のフィールド名差分(`key/effect/implemented_in_pokechan`) | `items_database.js`固有の命名 | ページ側で`slug→key`,`effect_house→effect`,`implemented→implemented_in_pokechan`の読み替えアダプタを書くだけ(items_db_all_v2.htmlで実証済み)。masterやpokedb.js自体の変更は不要 | 低(パターン確立済み) |
| ⑨(参考・移行外) | `ABILITY_TYPE_IMMUNITY`(特性→タイプ無効の事実表) | `reference/_page_ledger.json`に既出登録済み・masterへの正式収録は判断待ち | 別ラインの判断待ち事項として②移行とは独立に進行中 | 判断待ち(既出) |

**cnt4/cnt2等の弱点集計列・169技分のbool列・`national_new`・`added_in`等は、いずれも「masterの既存
フィールドから1〜数行で計算し直せる派生値」であり、pokedb.js/masterを広げる対象には含めていない**
(現行ページの多く=`pokemon_db_v9.html`が実際に自前再計算している通り)。

---

## 7. (b) 移行のおすすめ順とパイロット候補

**難易度順(小→大)**: `speed_compare.html` < `suggest_lite.html` ≒ `suggest_partner.html`
< `damage_calc.html`(検索UI部分のみ) < `waza-list.html`/`waza-list_all.html`(`waza_picker.js`共有)
< `waza-list_v2.html`(`waza_picker_v2.js`単独・要 v2/v3 統廃合判断) < `party_checker.html`
≒ `pokemon_db_v9.html`/`pokemon_db_all_v9.html`(この2つは統合前提なら実質1件の大仕事)。

**依存関係による前提条件**:
- `waza-list*`系に着手するなら**先に §6③④(champions_key索引・learners()のmode対応)をpokedb.jsに実装**
  しておかないと、移行後に不正確な結果(学習者一覧の過剰カウント)を生む。
- `party_checker.html`/`pokemon_db_v9.html`系に着手するなら**先に §6①(TYPE_KANJI等4アクセサ)と
  §6⑥(STAT_RANKの扱い方針)を決めておく**必要がある。

**パイロット候補: `speed_compare.html`**。理由:
1. 使用グローバルが`POKEMON_LIST`と`TYPE_COLORS`の2つだけ(§4-2)で、pokedb.jsとのgapがゼロ
   (§6のリストに一切かからない)。
2. 独自データ(`BATTLE_ONLY_FORMS`)はあるが他ページとの共通化が主目的で移行の妨げにならない。
3. 同期→非同期の書き換え箇所が1箇所(`speed_compare.html:439`)のみで、`init()`の呼び出し起点
   (`speed_compare.html:764`)も既に1箇所に集約されている=**最小の変更で完走できる実証実験になる**。
4. `items_db_all_v2.html`/`ability_all.html`という2つの実例(§0)に続く**3件目・かつ最初の
   「一覧表以外(計算ツール系)」の実例**になるため、damage_calc.html/party_checker.htmlのような
   より複雑な計算ツールへの応用可否を早期に検証できる。

次点は`suggest_lite.html`/`suggest_partner.html`(2ページ同時。兄弟構造なので1本の移行作業で
両方に知見を転用できる)。

---

## 8. (c) `_v2`が既に存在するページの新版命名案

| 現行ファイル | 既存の`_v2`有無 | 新版の命名案 | 理由 |
|---|---|---|---|
| `waza-list.html` | `waza-list_v2.html`が**既に存在**(canonicalは`waza-list.html`側なので実質`_v2`は非正典の旧試作扱い) | `waza-list_v3.html` | `_v2`が空いていないため。ただし**先に`waza-list_v2.html`をどう扱うか(§9🙋)を決めてから**命名すべき(v2を「昇格させず退避」するのか「削除」するのかで、新版が`_v2`を再利用できるかが変わる) |
| `waza-list_all.html` | 無し(`_all`という別サフィックス体系) | `waza-list_all_v2.html` | 既存の`_all`命名規則を踏襲しつつバージョンを重ねる。`waza-list.html`側が`_v3`になるなら整合を取って`waza-list_all_v3.html`にする案もあるが、両ファイルは`waza_picker.js`を共有しているため**セットで同じ番号にすることを推奨** |
| `pokemon_db_v9.html` | 無し(`_v9`というバージョン番号が既にファイル名に埋め込まれている独自体系) | `pokemon_db_v10.html`(現行の命名規則`_vN`を延長)。ただし**この2ファイルの統合(§9提案)を採るなら`pokemon_db_v10.html`1本に一本化**し、`pokemon_db_all_v9.html`は昇格後に退避 | `_v9`という既存の連番規則に従うのが自然。`_v2`とは別の命名体系がすでに走っているページなので、他ページの`_v2`ルールを持ち込むと逆に混乱する |
| `pokemon_db_all_v9.html` | 同上 | 統合しない場合は`pokemon_db_all_v10.html` | 同上 |
| `party_checker.html` | 無し | `party_checker_v2.html` | 素直に空いている`_v2`を使える |
| `damage_calc.html` | 無し | `damage_calc_v2.html` | 同上 |
| `suggest_lite.html` / `suggest_partner.html` | 無し | `suggest_lite_v2.html` / `suggest_partner_v2.html` | 同上 |
| `speed_compare.html` | 無し | `speed_compare_v2.html` | 同上 |
| `items_db_all_v2.html` | (参考=既に`_v2`側が本番) | 次に作るならv3の順番になる想定 | 参考情報として記載 |

---

## 9. (d) 阿部さんの判断が要る点(🙋)

1. **`waza-list_v2.html`(`waza_picker_v2.js`)の扱い**: `waza-list.html`(新しい`waza_picker.js`・
   今日も更新継続中)と`waza-list_v2.html`(古い`waza_picker_v2.js`・2026-06-18で止まっている)が
   並存している。canonicalは`waza-list.html`なので`_v2`側は既に非正典。②の移行を機に
   `waza-list_v2.html`を退避・削除してよいか、それとも別の意図(A/Bテスト等)で残しているのか確認したい。
   これが決まらないと§8の命名(`_v2`を再利用できるか`_v3`にすべきか)も決められない。
2. **`pokemon_db_v9.html`と`pokemon_db_all_v9.html`の統合可否**: 実測でトップレベル定数の差が
   `REGULATIONS`1個、関数定義の差が1個しかなく、4800行がほぼ丸ごと複製されている(§4-5)。
   pokedb.jsは元々`setMode('champions'|'all')`で1本のデータを絞り込む設計なので、**②移行と同時に
   1ファイルへ統合するのが理にかなっている**が、統合はページ構造(URL・SEO・広告枠含む)に影響するため
   進め方(先に統合してから移行/移行してから統合/統合しない)を確認したい。
3. **`STAT_RANK`(種族値の全国内順位)をpokedb.jsに計算ロジックとして持たせてよいか**(§6⑥)。
   「pokedb.jsはデータを1バイトも持たない薄いローダ」という現行設計方針(`pokedb.js:1-9`のコメントに
   明記)と、「派生データの計算はどこかに要る」という実用上の要請が衝突する箇所。案(a)pokedb.js内で計算・
   (b)masterに事前計算値として持たせる・(c)ページ側の個別実装のまま、のどれを採るか。
4. **`master/types.json` `meta.tables`の`TYPE_KANJI`/`TYPE_DISPLAY`/`TYPE_OFFENSIVE_STATS`/
   `DEFAULT_TYPE_ORDER`を`pokedb.js`のアクセサとして正式に生やしてよいか**(§6①)。`typeChart()`と
   同型なので技術的には即着手できるが、pokedb.jsの公開APIが増えることの確認として一応明記。
5. **`ITEMS_DATABASE`固有のトップレベル項目(`categories`索引・`stats`・`regulations`・`mega_rules`)を
   移行時にどう扱うか**(§3)。今回の調査では`party_checker.html`からの参照が実質ゼロ(`categories`は
   自前グルーピングに置き換わっており、`stats`/`regulations`/`mega_rules`は未参照)と確認できたため
   **単純に破棄してよさそう**だが、他の未調査ページ(battle_simulator.html等・③凍結中)で参照している
   可能性は今回の調査範囲外なので、③解禁時に再確認が必要という前提を明記しておきたい。
6. **`waza_picker.js`の`_extractPriority()`が技の説明文からの正規表現抽出になっている件**(§4-4)。
   移行のスコープ外ではあるが、`master/moves.json`に既にある`priority`数値フィールドを使わず
   文字列パースに依存している実装は、②移行の良い機会に直しておくべきか、それとも別タスクとして
   切り出すか確認したい。

---

*作成: 調査専用(W10)。ファイル変更なし。参照した実データ: `master/pokemon.json`(1273件)・
`master/moves.json`(919件)・`master/abilities.json`(313件)・`master/items.json`(423件)・
`master/learnsets.json`(1273件)・`master/natures.json`(25件)・`master/types.json`(18件)・
`master/regulations.json`(2件)。すべて2026-09-04時点のリポジトリ内容(git status確認済み・
対象ファイルはいずれも作業中の未コミット差分なし)。*
