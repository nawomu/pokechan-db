// tools/_build_phase_inventory.js
// P1: フェーズ割り当て用「全機構インベントリ」抽出（機械作業・判断禁止）
// 依頼元: claude-design → glm-impl (scratchpad_glm_task_phase_inventory.md)
//
// やること: リポジトリ内の実データから機械的に抽出して1つのJSON+サマリmdを作る。
// 判断・分類・推測はしない。取れなかったものは「取れなかった」と書く。
//
// 出力:
//   reference/_phase_inventory_2026_07_26.json
//   reference/_phase_inventory_summary_2026_07_26.md
//
// 実行: node tools/_build_phase_inventory.js

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_JSON = path.join(ROOT, "reference/_phase_inventory_2026_07_26.json");
const OUT_MD = path.join(ROOT, "reference/_phase_inventory_summary_2026_07_26.md");

// ============================================================
// データファイル読込
// pokechan_data_*.js はトップレベル const で定義されているため、
// 関数スコープで包んで束縛を取り出す(vmのconstはコンテキストに残らない)。
// ============================================================
function loadData(srcPath) {
  const src = fs.readFileSync(srcPath, "utf8");
  const wrapper = "(function(window){\n" + src + "\n;return {WAZA_MAP, ABILITY_DESC};\n})";
  const fn = eval(wrapper); // eslint-disable-line no-eval
  return fn({});
}
function loadItems(srcPath) {
  const src = fs.readFileSync(srcPath, "utf8");
  // items_database.js は window.ITEMS_DATABASE = {...} 形式
  const fn = new Function("window", src + "\n;return window.ITEMS_DATABASE;");
  return fn({});
}

const allData = loadData(path.join(ROOT, "pokechan_data_all.js")); // 全部版
const chamData = loadData(path.join(ROOT, "pokechan_data.js"));    // Champions版
const itemsDb = loadItems(path.join(ROOT, "items_database.js"));

// ============================================================
// 1. 技 effect kind 一覧（全部版 WAZA_MAP の battle_data.effects）
// ============================================================
const W = allData.WAZA_MAP || {};
const wazaEntries = Object.values(W);

const kindMap = new Map(); // kind -> 集計レコード
const noKindEffects = [];        // .kind 無し effect
const nestedKinds = [];          // 深い階層で見つかった kind（構造が想定と違う場合の手がかり）
let wazaWithNoEffectsArray = 0;  // battle_data.effects が配列で無い
let wazaWithEmptyEffects = 0;    // effects == []
let totalEffects = 0;

// effect オブジェクトを再帰的に走査し、任意の深さの kind を収集
function walkEffect(obj, depth, wazaName, topKind) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const v of obj) walkEffect(v, depth, wazaName, topKind);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "kind" && typeof v === "string") {
      if (depth > 1) nestedKinds.push({ waza: wazaName, kind: v, depth, parent_kind: topKind });
    }
    if (v && typeof v === "object") walkEffect(v, depth + 1, wazaName, topKind || obj.kind);
  }
}

for (const w of wazaEntries) {
  const fx = w.battle_data && Array.isArray(w.battle_data.effects) ? w.battle_data.effects : null;
  if (!fx) { wazaWithNoEffectsArray++; continue; }
  if (fx.length === 0) { wazaWithEmptyEffects++; continue; }
  for (const e of fx) {
    totalEffects++;
    // 浅い走査（トップレベルの kind のみで集計するのが本体）
    const kind = e.kind;
    if (typeof kind !== "string") { noKindEffects.push({ waza: w.name, effect: e }); continue; }
    let rec = kindMap.get(kind);
    if (!rec) {
      rec = { waza: new Set(), instances: 0, phases: new Map(), fields: new Set(), samples: [] };
      kindMap.set(kind, rec);
    }
    rec.instances++;
    rec.waza.add(w.name);
    if (rec.samples.length < 5) rec.samples.push(w.name);
    const phase = e.phase !== undefined ? String(e.phase) : "__no_phase__";
    rec.phases.set(phase, (rec.phases.get(phase) || 0) + 1);
    for (const k of Object.keys(e)) if (k !== "kind") rec.fields.add(k);
    // 深い階層の kind 有無を別途記録（構造の地ならし用）
    walkEffect(e, 1, w.name, kind);
  }
}

const effectKinds = [...kindMap.entries()]
  .map(([kind, rec]) => ({
    kind,
    waza_count: rec.waza.size,                 // その kind を使う技数（重複抜き）
    instance_count: rec.instances,             // effect 出現数（同一技で複数可）
    sample_waza: rec.samples,                   // 代表技名（最大5）
    phase_distribution: Object.fromEntries([...rec.phases.entries()].sort((a, b) => b[1] - a[1])),
    fields: [...rec.fields].sort()              // kind 以外に使われるフィールド名一覧
  }))
  .sort((a, b) => b.instance_count - a.instance_count || a.kind.localeCompare(b.kind));

// ============================================================
// 2. 特性一覧（全部版 + Champions版 ABILITY_DESC）
// ============================================================
const abAll = allData.ABILITY_DESC || {};
const abCham = chamData.ABILITY_DESC || {};
const abNames = new Set([...Object.keys(abAll), ...Object.keys(abCham)]);
const abilities = [...abNames].sort().map((name) => ({
  name,
  desc_all: abAll[name] != null ? abAll[name] : null,         // 全部版の説明文全文
  desc_champions: abCham[name] != null ? abCham[name] : null, // Champions版の説明文全文
  in_all: name in abAll,
  in_champions: name in abCham,
  same_desc: (name in abAll) && (name in abCham) && abAll[name] === abCham[name] // 機械的等価判定のみ
}));
const abilityInAllOnly = abilities.filter((a) => a.in_all && !a.in_champions).map((a) => a.name);
const abilityInChamOnly = abilities.filter((a) => !a.in_all && a.in_champions).map((a) => a.name);
const abilityDescDiffers = abilities.filter((a) => a.in_all && a.in_champions && !a.same_desc).map((a) => a.name);

// ============================================================
// 3. 持ち物一覧（items_database.js ITEMS_DATABASE.items）
// ============================================================
const itemList = Array.isArray(itemsDb.items) ? itemsDb.items : [];
const items = itemList.map((it) => ({ ...it })); // 全フィールドをそのまま（選択判断しない）

// ============================================================
// 4. エンジン内 特性照合箇所の粗マップ（real_battle_simulator.html を grep）
//    *Ability*( 系の呼び出し行を拾い、最初の文字列リテラル引数を「特性名候補」とする
//    正規表現で拾える範囲。拾えないものは unlisted に行番号+スニペットのみ。
// ============================================================
const FN_NAMES = [
  "sideAbility", "defAbilityVs", "hasAbilityShield",
  "fireEntryAbility", "renderAbilitySelect", "dummyAbilityList", "attachAbilityChange"
];
const FN_RE = new RegExp("\\b(" + FN_NAMES.join("|") + ")\\s*\\(", "g");
const STRARG = /["'`]([^"'`\n]{1,60})["'`]/;

const engLines = fs.readFileSync(path.join(ROOT, "real_battle_simulator.html"), "utf8").split("\n");
const abilityRef = new Map(); // name -> [{line, fn}]
const unlisted = [];
const fnCallCounts = {}; // fn -> 呼び出し件数

engLines.forEach((line, i) => {
  const lineNo = i + 1;
  FN_RE.lastIndex = 0;
  let m;
  while ((m = FN_RE.exec(line)) !== null) {
    const fn = m[1];
    fnCallCounts[fn] = (fnCallCounts[fn] || 0) + 1;
    const after = line.slice(m.index + m[0].length);
    const s = after.match(STRARG);
    if (s) {
      const name = s[1];
      if (!abilityRef.has(name)) abilityRef.set(name, []);
      abilityRef.get(name).push({ line: lineNo, fn });
    } else {
      unlisted.push({ line: lineNo, fn, snippet: line.trim().slice(0, 140) });
    }
  }
});
const abilityRefs = [...abilityRef.entries()]
  .map(([name, hits]) => ({ name, hit_count: hits.length, hits }))
  .sort((a, b) => b.hit_count - a.hit_count || a.name.localeCompare(b.name));

// ============================================================
// 集約JSON 書き出し
// ============================================================
const result = {
  meta: {
    generated_for: "phase_inventory_P1 (claude-design → glm-impl)",
    note: "機械抽出のみ。判断・分類・推測は含まない。取れなかった箇所は notes/caveats に列挙。",
    sources: {
      waza_all: "pokechan_data_all.js (WAZA_MAP)",
      ability_all: "pokechan_data_all.js (ABILITY_DESC)",
      ability_champions: "pokechan_data.js (ABILITY_DESC)",
      items: "items_database.js (window.ITEMS_DATABASE.items)",
      engine: "real_battle_simulator.html"
    },
    counts: {
      waza_total: wazaEntries.length,
      waza_with_effects: wazaEntries.length - wazaWithNoEffectsArray - wazaWithEmptyEffects,
      waza_with_no_effects_array: wazaWithNoEffectsArray,
      waza_with_empty_effects: wazaWithEmptyEffects,
      total_effect_instances: totalEffects,
      effect_kinds: effectKinds.length,
      abilities_union: abilities.length,
      abilities_in_all: Object.keys(abAll).length,
      abilities_in_champions: Object.keys(abCham).length,
      items: items.length,
      engine_ability_ref_names: abilityRefs.length,
      engine_total_hits: abilityRefs.reduce((s, a) => s + a.hit_count, 0),
      engine_unlisted_hits: unlisted.length
    },
    caveats: [] // 末尾で追記
  },

  effect_kinds: effectKinds,
  effects_without_kind: noKindEffects,
  nested_kinds: nestedKinds,

  abilities,
  ability_index: {
    in_all_only: abilityInAllOnly,
    in_champions_only: abilityInChamOnly,
    desc_differs_between_files: abilityDescDiffers
  },

  items,

  engine_ability_refs: {
    function_call_counts: fnCallCounts,
    names: abilityRefs,
    unlisted
  }
};

// ---- caveats（正直な列挙） ----
const caveats = [];
if (wazaWithNoEffectsArray > 0) caveats.push(`battle_data.effects が配列で無い技: ${wazaWithNoEffectsArray}件（effect kind 集計対象外）`);
if (noKindEffects.length > 0) caveats.push(`トップレベルに .kind を持たない effect: ${noKindEffects.length}件（effects_without_kind に全文格納）`);
if (nestedKinds.length > 0) caveats.push(`effect の深い階層に kind が見つかった: ${nestedKinds.length}件（nested_kinds に格納。本集計はトップレベル kind のみ）`);
caveats.push("effect kind の phase 集計は effect 直下の .phase のみ。phase 無しは __no_phase__ として集計。");
caveats.push("特性説明文: 全部版とChampions版で別物の可能性があるため両方を別々に保持（desc_differs_between_files に機械的差分ありの名前を列挙）。");
if (abilityInAllOnly.length) caveats.push(`全部版にのみ存在する特性: ${abilityInAllOnly.length}件`);
if (abilityInChamOnly.length) caveats.push(`Champions版にのみ存在する特性: ${abilityInChamOnly.length}件`);
caveats.push("持ち物: items_database.js の items 配列(169件想定)を全フィールドそのまま収録。implemented_in_pokechan 等のフラグもrawに含む。");
caveats.push("エンジン特性照合: *Ability*( 系7関数の呼び出し行を走査。最初の文字列リテラル引数を「特性名候補」とした（変数引数や複雑な式は unlisted）。");
caveats.push("エンジン注意: 文字列リテラル引数が必ず特性名とは限らない（defAbilityVs 等でカテゴリ/タイプ文字列の可能性）。名前解決は設計側で要確認。");
caveats.push("エンジン注意: 本抽出は real_battle_simulator.html のみ。battle_simulator.html 等の別エンジンは対象外。");
result.meta.caveats = caveats;

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
console.log("WROTE", path.relative(ROOT, OUT_JSON));

// ============================================================
// サマリmd
// ============================================================
const c = result.meta.counts;
const md = [
  "# フェーズインベントリ抽出 P1 サマリ（機械作業・判断なし）",
  "",
  "- 依頼: claude-design → glm-impl (`scratchpad_glm_task_phase_inventory.md`)",
  "- 出力JSON: `reference/_phase_inventory_2026_07_26.json`",
  "- 実行: `node tools/_build_phase_inventory.js`",
  "",
  "## 件数表",
  "",
  "| 項目 | 件数 |",
  "|---|---|",
  `| 技(全部版 WAZA_MAP) | ${c.waza_total} |`,
  `| 　うち effects 非空配列 | ${c.waza_with_effects} |`,
  `| 　うち effects 配列で無い | ${c.waza_with_no_effects_array} |`,
  `| 　うち effects == [] | ${c.waza_with_empty_effects} |`,
  `| effect instance 総数 | ${c.total_effect_instances} |`,
  `| **effect kind 数** | **${c.effect_kinds}** |`,
  `| 特性(全部版∪Champions) | ${c.abilities_union} |`,
  `| 　全部版のみ | ${abilityInAllOnly.length} |`,
  `| 　Champions版のみ | ${abilityInChamOnly.length} |`,
  `| 　両ファイルで説明文が異なる | ${abilityDescDiffers.length} |`,
  `| **持ち物** | **${c.items}** |`,
  `| エンジン特性照合: 抽出名(候補)数 | ${c.engine_ability_ref_names} |`,
  `| エンジン特性照合: 総ヒット数 | ${c.engine_total_hits} |`,
  `| エンジン特性照合: unlisted(文字列引数取れず) | ${c.engine_unlisted_hits} |`,
  "",
  "## エンジン *Ability*( 系 関数別 呼び出し件数",
  "",
  "| 関数 | 件数 |",
  "|---|---|",
  ...Object.entries(fnCallCounts).sort((a, b) => b[1] - a[1]).map(([fn, n]) => `| ${fn} | ${n} |`),
  "",
  "## 抽出できなかった・想定と違った箇所（正直な列挙）",
  "",
  ...caveats.map((x) => "- " + x),
  "",
  "## 代表的な effect kind（上位10・参考）",
  "",
  "| kind | 技数 | instance数 | phase分布 | fields数 |",
  "|---|---|---|---|---|",
  ...effectKinds.slice(0, 10).map((k) => {
    const ph = Object.entries(k.phase_distribution).map(([p, n]) => `${p}:${n}`).join(" ");
    return `| ${k.kind} | ${k.waza_count} | ${k.instance_count} | ${ph} | ${k.fields.length} |`;
  }),
  "",
  "(全kindの一覧・fields詳細・特性/持ち物全文はJSON参照)"
].join("\n");

fs.writeFileSync(OUT_MD, md);
console.log("WROTE", path.relative(ROOT, OUT_MD));

// ============================================================
// 自己検証: JSON を書き戻して parse できるか・件数整合を確認
// ============================================================
const verify = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
const v = verify.meta.counts;
const ok =
  v.waza_total === wazaEntries.length &&
  v.effect_kinds === effectKinds.length &&
  v.abilities_union === abilities.length &&
  v.items === items.length &&
  verify.effect_kinds.length === effectKinds.length &&
  verify.abilities.length === abilities.length &&
  verify.items.length === items.length;
console.log("\n=== SELF-VERIFY ===");
console.log("JSON parse: ok");
console.log("counts match:", ok);
console.log("effect_kinds:", v.effect_kinds, "| abilities:", v.abilities_union, "| items:", v.items);
console.log("effects_without_kind:", noKindEffects.length, "| nested_kinds:", nestedKinds.length, "| unlisted:", unlisted.length);
if (!ok) { console.error("VERIFY FAILED"); process.exit(1); }
console.log("ALL CHECKS PASSED");
