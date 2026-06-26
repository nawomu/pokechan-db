/** 全国版ポケモンDB(共通SSOT・全部入り)の運用ルール集約ビュー。
 *  SSOT=HANDOFF_SESSION_2026_06_26_PART2.md / CLAUDE.md。本HTMLはその集約ビュー(今後の更新の道しるべ)。
 *  実行: node tools/_db_rules.js → review/db_rules.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

// データの流れ(ASCII)
const FLOW = `reference/*.json  ← 大元SSOT(PokeAPI由来・9言語)
  pokeapi_master.json(1302) / moves_master.json(937) / items_master.json(2180)
  abilities_master.json(367) / learnsets_master.json(覚える技)
        │  + 派生データ(WF生成): moves_ja_desc.json / moves_tags.json / legend_status.json
        ▼
tools/_build_pokechan_data_all.js   ← アダプタ(変換・オーバーレイ)
        ▼
pokechan_data_all.js   ← 共通DB(pokechan_data.js と同一schema・全1219ポケ/937技)
        ▼
各ページは <script src> で読むだけ(ハードコード禁止):
  pokemon_db_all_v9.html(全国版ポケDB) / waza-list_all.html(全国版わざ)`;

// ルール(R1〜R8)
const RULES = [
  ['R1', '共通SSOT 1本化(最重要)',
    '<b>大元 = <code>reference/*.json</code></b>(PokeAPI由来・9言語名つき)。<b>アダプタ <code>tools/_build_pokechan_data_all.js</code> → <code>pokechan_data_all.js</code></b> が、大元から <code>pokechan_data.js</code> と<b>同一schema</b>(POKEMON_LIST/WAZA_MAP/POKEMON_WAZA/TYPES/NATURES/ABILITY_DESC…)を生成。全国版の各ページはこれを読むだけ。<br><b>更新運用</b>: 新ポケ/技 → ①<code>_fetch_pokeapi_*.js</code>(masters/varieties/learnsets)再生成 → ②<code>_build_pokechan_data_all.js</code> 再生成 → ③<b>HTMLは無変更</b>。これが「追加はデータに足すだけ」の達成形。'],
  ['R2', '既存デザインのクローン方式',
    '本番ページを<b>コピーして1行差し替え</b>(<code>pokechan_data.js</code>→<code>pokechan_data_all.js</code>)だけで全国版にする。<b>CSS/JSは触らない</b>。<br>共有ファイル(<code>waza_picker.js</code>等)を触る時は<b>ガード</b>を入れて本番に影響させない(例: <code>national_new</code> は本番Championsデータに無=常にfalse → 本番waza-listは無変化)。'],
  ['R3', '見た目だけのフォームは間引く',
    '「<b>種族値+タイプ+特性が基本形と同一</b>」or キャップ/コスプレ/トーテム/gmax/starter のフォームは全国版から<b>除外</b>(1302→1219)。アダプタの <code>isCosmetic()</code>。<br>メガ/リージョン/ロトム/デオキシス等「<b>中身が違う</b>」フォームは<b>残す</b>。'],
  ['R4', 'Generation と Season は別項目(裏で両方管理)',
    '<b>Generation(Gen1〜9)</b>=dex由来・全ポケにあり・表記は翻訳不要(Gen1)。ポケモンDBの「Gen」列で表示。<br><b>Season(M-A/M-B)</b>=Champions のシーズン(「使える季・複数可」)。Champions名簿に名前一致した分だけ。<b>裏(データ)に持つが全国版テーブルには出さない</b>(非Championsが大半=空列回避)。本番Champions DB(<code>pokemon_db_v9.html</code>)には<b>SSN列</b>で表示(全行に値=映える)。'],
  ['R5', '伝説区分マーク',
    '<b>出典</b>: PokeAPI species の <code>is_legendary</code>/<code>is_mythical</code> + <b>禁止級(Restricted)は固定リスト</b>(<code>reference/legend_status.json</code> 生成器内)。<br><b>3区分</b>: 禁止級伝説(Restricted)/準伝説(Sub-Legendary)/幻(Mythical)。<b>マーク</b>: JA=<b>禁/準/幻</b>、英語+多言語=<b>R/S/My</b>(MythicalのMはメガと被るのでMy)。<b>ポケモン名列でなく「型」列</b>(メガ M と併存)に表示+型フィルタに選択肢追加。'],
  ['R6', 'タグ/グループは battle_data の effects から(手で並べない)',
    'CLAUDE.md原則。新技445は<b>ダイナミックワークフローで構造化effects(状態付与/能力ランク変化/急所/連続/反動/回復/設置/フィールド…)を生成</b> → <code>reference/moves_tags.json</code> → アダプタ <code>bdFromTags()</code> で battle_data 化 → <b>既存タグエンジンが自動でタグ化</b>。手で並べ替えない。'],
  ['R7', '説明文はマザーリスト(公開waza-list)のスタイルに合わせる',
    'マザー(本番 <code>pokechan_data.js</code> の description)は<b>簡潔技術スタイル</b>: 自身/敵・〜化(こおり化)・確率N%で・<b>ダメージのみ</b>/<b>ダメージ。{効果}</b>・N段階上昇/低下・分数(1/3, 最大HP/8)。<br>全国版リファレンスは<b>マザー流に統一</b>(2026-06-26 阿部さん確定)。※CLAUDE.md北極星(子ども口調)とは別系統。声の最終判定は阿部さんの耳。'],
  ['R8', 'PDCA(画面確認)を毎回・本番は確認後',
    '変更後は<b>Playwright実機でJSエラー0・件数・描画・操作を確認してから報告</b>。<b>中身まで見る</b>(効果列が埋まってるか等)=JSエラー0だけで「できた」と言わない。<br>全部ローカルで確認 → <b>阿部さんOK後に commit→push</b>。'],
];

// 後工程(順番)
const TODO = [
  '① 新技445の effects/タグ/説明を阿部さんが確認・確定(場=<code>review/waza_list_confirm.html</code> の🆕新規 / <code>review/_new_moves_review.html</code>)',
  '② → waza-list全部版のグループ分けを確定(新技のグループは現状<b>暫定=自動導出</b>)',
  '③ → ポケモンDBわざ列の subcategory を正式化(<code>subcatFromTags</code> を確定分類に差替)。順番=waza-list確定→ポケモンDB追従',
  '④ コミット→本番公開(pchamdb.com)+ 公開導線(index→全国版)',
  '後回し: 全部版の9言語i18n / 道具を既存デザインに / sim全部版(937技の battle_data 整備)',
];

const FILES = [
  ['共通SSOTアダプタ', 'tools/_build_pokechan_data_all.js → pokechan_data_all.js'],
  ['learnset取得/QA', 'tools/_fetch_pokeapi_learnsets.js / _qa_learnsets.js / _qa_pokechan_all.js'],
  ['全国版ポケDB(v9形)', 'pokemon_db_all_v9.html'],
  ['全国版わざリスト', 'waza-list_all.html(+ waza_picker.js に national_new配線)'],
  ['新技 説明/タグ/伝説', 'reference/{moves_ja_desc,moves_tags,legend_status,learnsets_master}.json'],
  ['確認ビュー(新技合流)', 'review/waza_list_confirm.html ← tools/_waza_list_confirm.js'],
  ['新技単体レビュー', 'review/_new_moves_review.html ← tools/_build_new_moves_review.js'],
  ['本番Champions DB', 'pokemon_db_v9.html(SSN列)'],
];

const ruleCard = (r) => `<div class="card"><div class="rid">${r[0]}</div><div class="rbody"><div class="rt">${r[1]}</div><div class="rd">${r[2]}</div></div></div>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>全国版ポケモンDB 運用ルール - PchamDB</title>
<style>
body{font-family:system-ui,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;margin:0;background:#f4f6f8;color:#222;font-size:13.5px;line-height:1.75}
h1{font-size:17px;margin:0;padding:13px 18px;background:#1F4E79;color:#fff;position:sticky;top:0;z-index:5}
.wrap{max-width:1000px;margin:0 auto;padding:16px}
.lead{background:#fffdf0;border:1px solid #eed7a1;border-radius:8px;padding:12px 14px;color:#5a4a1a;margin-bottom:16px}
h2{font-size:14px;color:#1F4E79;border-left:5px solid #1F4E79;padding-left:8px;margin:22px 0 10px}
pre.flow{background:#0f1722;color:#cfe0f5;padding:14px;border-radius:8px;font-size:12px;line-height:1.6;overflow-x:auto}
.card{display:flex;gap:12px;background:#fff;border:1px solid #e2e7ec;border-radius:8px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.rid{flex:0 0 40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1F4E79;color:#fff;font-weight:800;border-radius:8px}
.rt{font-weight:800;color:#16314f;margin-bottom:4px}
.rd{color:#33415c}
code{background:#eef2f7;padding:1px 5px;border-radius:4px;font-size:12px;color:#1a4f72}
ol.todo{background:#fff;border:1px solid #e2e7ec;border-radius:8px;padding:12px 14px 12px 34px}
ol.todo li{margin-bottom:6px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e2e7ec;border-radius:8px;overflow:hidden}
th,td{border-bottom:1px solid #eef2f7;padding:7px 10px;text-align:left;font-size:12.5px}
th{background:#eef2f7;color:#1F4E79}
td:first-child{font-weight:700;color:#16314f;white-space:nowrap}
.foot{color:#7a8aa0;font-size:11.5px;margin-top:20px;border-top:1px solid #dde;padding-top:10px}
</style></head><body>
<h1>📘 全国版ポケモンDB 運用ルール(共通SSOT・全部入り)</h1>
<div class="wrap">
<div class="lead">このページは<b>今後の更新の道しるべ</b>。SSOT=<code>HANDOFF_SESSION_2026_06_26_PART2.md</code> / <code>CLAUDE.md</code> の集約ビュー。<br>※わざ<b>説明文の書き方/言葉</b>ルールは別ページ <code>review/rules.html</code>。こちらは<b>DBの構造・データ運用</b>のルール。</div>

<h2>データの流れ(大元1本 → 全画面)</h2>
<pre class="flow">${FLOW.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>

<h2>運用ルール R1〜R8</h2>
${RULES.map(ruleCard).join('\n')}

<h2>★後でやること(順番が大事)</h2>
<ol class="todo">${TODO.map(t=>`<li>${t}</li>`).join('')}</ol>

<h2>主要ファイル早見</h2>
<table><thead><tr><th>用途</th><th>ファイル</th></tr></thead><tbody>
${FILES.map(f=>`<tr><td>${f[0]}</td><td><code>${f[1]}</code></td></tr>`).join('')}
</tbody></table>

<div class="foot">生成: <code>node tools/_db_rules.js → review/db_rules.html</code>。ルール本体を直したらこのファイルでなく <code>tools/_db_rules.js</code> を編集して再生成(二重管理しない)。</div>
</div></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'db_rules.html'), html);
console.log('生成: review/db_rules.html / ルール', RULES.length, '+ 後工程', TODO.length, '+ ファイル', FILES.length);
