// 残22技 ヤック↔compose 照合ハーネス(ループで毎回回す)
// 使い方: node tools/_build_pokechan_data_all.js && node tools/_verify22.js
const d = require("../pokechan_data_all.js");
const W = d.WAZA_MAP;
const SLUGS = ["rage", "rollout", "foresight", "miracle-eye", "punishment", "heart-swap", "sky-drop", "synchronoise", "water-pledge", "powder", "shell-trap", "snipe-shot", "incinerate", "dark-void", "double-shock", "thunderclap", "purify", "laser-focus", "revival-blessing", "autotomize", "struggle"];
let undefCount = 0, emptyEff = 0;
for (const s of SLUGS) {
  const m = W[s];
  if (!m) { console.log("\n❌ " + s + " WAZA_MAP無し"); continue; }
  const effs = ((m.battle_data || {}).effects || []);
  const effStr = effs.map(e => e.kind).join(", ") || "(空)";
  const desc = m.description || "";
  const flags = [];
  if (desc.includes("undefined")) { flags.push("⚠UNDEF"); undefCount++; }
  if (effs.length === 0 && m.category === "変化") { flags.push("⚠EFF空(変化技)"); emptyEff++; }
  console.log("\n■ " + m.name + " (" + s + ") " + flags.join(" "));
  console.log("  eff: [" + effStr + "]");
  console.log("  新: " + desc);
  console.log("  ヤ: " + (m.description_legacy || "(空)"));
}
console.log("\n===== サマリ: undefined=" + undefCount + " / 変化技でeff空=" + emptyEff + " =====");
