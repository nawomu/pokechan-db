// tools/_check_unimplemented_abilities.js
// T6 シグナル6: 「エンジン未実装(engine_lines=[]) なのに Championsロスターのポケモンが持っている特性」
// を機械照合する(本番で無言の不発になる = risk高 の根拠)。
//   依頼: claude-design → glm-impl (scratchpad_glm_task_T6_risky_abilities.md)
//   実行: node tools/_check_unimplemented_abilities.js
//   出力: stdout に件数+一覧(JSONも標準出力末尾)。本スクリプトは tools/1本のみ(新規)。
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

// ---- master_v2 読込 ----
const MASTER_PATH = path.join(ROOT, "reference/_phase_assign/abilities_master_v2.json");
const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
const list = Array.isArray(master) ? master : Object.values(master);

// engine_lines が空([]) の特性 = エンジン未実装(の疑い)
const isEmpty = (a) => !a.engine_lines || (Array.isArray(a.engine_lines) && a.engine_lines.length === 0);
const unimplemented = list.filter(isEmpty);
const unimplNames = new Set(unimplemented.map((a) => a.name));

// ---- Championsロスター(pokechan_data.js POKEMON_LIST) 読込 ----
const chamSrc = fs.readFileSync(path.join(ROOT, "pokechan_data.js"), "utf8");
const fn = eval("(function(window){\n" + chamSrc + "\n;return {POKEMON_LIST};\n})"); // eslint-disable-line no-eval
const POKEMON_LIST = fn({}).POKEMON_LIST || [];

// ab1/ab2/ab3 に出る特性名 → 保持者ポケモン名
const holderMap = new Map(); // ability -> [poke names]
for (const p of POKEMON_LIST) {
  for (const k of ["ab1", "ab2", "ab3"]) {
    const ab = p && p[k];
    if (ab && typeof ab === "string" && ab.trim()) {
      if (!holderMap.has(ab)) holderMap.set(ab, []);
      holderMap.get(ab).push(p.name);
    }
  }
}

// ---- 突き合わせ: 未実装 のうち Championsロスターが持つもの ----
const rosterAbilityNames = new Set(holderMap.keys());
const heldButUnimplemented = [...unimplNames]
  .filter((n) => rosterAbilityNames.has(n))
  .map((n) => ({
    ability: n,
    holder_count: holderMap.get(n).length,
    holders: [...new Set(holderMap.get(n))].slice(0, 20) // 代表最大20
  }))
  .sort((a, b) => b.holder_count - a.holder_count);

// ---- ロスターが持つのに master_v2 自体に載っていない特性(別の意味での空白) ----
const masterNames = new Set(list.map((a) => a.name));
const notInMaster = [...rosterAbilityNames].filter((n) => !masterNames.has(n)).sort();

const report = {
  source: { master: "reference/_phase_assign/abilities_master_v2.json", roster: "pokechan_data.js (POKEMON_LIST)" },
  counts: {
    master_total: list.length,
    unimplemented_in_master: unimplemented.length,
    roster_ability_names: rosterAbilityNames.size,
    held_but_unimplemented: heldButUnimplemented.length,
    roster_abilities_not_in_master: notInMaster.length
  },
  held_but_unimplemented: heldButUnimplemented, // ★本番で無言の不発になる可能性 = risk高 候補
  roster_abilities_not_in_master: notInMaster
};

console.log("=== T6 signal6: 未実装(engine_lines=[]) × Champions保持 ===");
console.log("master総数:", report.counts.master_total);
console.log("未実装(engine_lines=[]):", report.counts.unimplemented_in_master);
console.log("ロスター特性名種:", report.counts.roster_ability_names);
console.log("★未実装なのにロスター保持:", report.counts.held_but_unimplemented);
console.log("ロスターが持つがmaster_v2未載:", report.counts.roster_abilities_not_in_master);
console.log("");
if (heldButUnimplemented.length) {
  console.log("★held_but_unimplemented 一覧(保持者数順):");
  for (const r of heldButUnimplemented) console.log(`  ${r.ability}  (保持者 ${r.holder_count}体)  例: ${r.holders.slice(0, 5).join("・")}`);
}
if (notInMaster.length) {
  console.log("\nロスターが持つが master_v2 に載っていない特性:");
  console.log("  " + notInMaster.join(" / "));
}
console.log("\n--- JSON ---");
console.log(JSON.stringify(report, null, 2));
