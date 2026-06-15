// 機械的(regex)に compose↔legacy のギャップを検出。LLM判定なし=偽陽性も偽陰性もあるが確実。
// 検出パターン:
//  A. legacyに数値(NN%/N倍/1/N/Nターン)があるのにcomposeに無い
//  B. composeに英語/JSON断片/フラグ生キーが露出
//  C. legacyに頻出名詞(まもる/みがわり/きのみ/てんき/みず/ゴースト等)があるのにcomposeに無い
//  D. composeとlegacyのverbatim長文一致(15字以上)=盗用リスク
// 実行: node tools/_scan_compose_gaps.js > /tmp/compose_gaps.json
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { compose } = require('./_waza_compose.js');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const WAZA_MAP = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

// 確実な機械漏れ語(JSONフィールド名/英語フラグ名)のみ。「HP」は日本語表現として正常なので除外。
const ENGLISH_WORDS = /(?<![\p{L}])(true|false|null|undefined|kind|stages|target|self|opponent|condition|value|duration|prob|multiplier|formula|basis|copy_target|sticky_web|punch|sound|contact|wind|protect|fang|bite|slash|hex|pulse|aura|charge|recoil|priority|substitute|reflect|screen|whirlwind|switch|stat|status|weather|hazard|psn|brn|par|slp|frz|attack|defense|spatk|spdef|speed|accuracy|evasion)(?![\p{L}])/iu;
const FLAG_RAW = /\bbattle_data\b|\bbattle-data\b|\bkind:|\beffects\[|\beffects\./i;
const NUM_RE = /(\d+)\s*%|(\d+)\s*倍|1\s*\/\s*(\d+)|(\d+)\s*ターン/g;
const KEYWORDS = ['まもる','みきり','みがわり','きのみ','道具','持ちもの','持ち物','てんき','天気','フィールド','急所','こうげき','ぼうぎょ','とくこう','とくぼう','すばやさ','命中率','回避率','ひるみ','まひ','やけど','ねむり','どく','こおり','こんらん','メロメロ','やどりぎ','ゴースト','ひこう','じめん','みず','ほのお','でんき','くさ','こおり','ロックオン','たくわえる','ふきとばし','ほえる'];

const out = [];
for (const m of Object.values(WAZA_MAP)) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  if (!eff.length) continue; // effects無しは対象外(legacy純粋技)
  let c = '';
  try { c = compose(m).text || ''; } catch (e) { c = ''; }
  if (!c) continue; // compose空っぽは別ライン(機械チェックで既知)
  const L = (m.description_legacy || '').replace(/\s+/g, '');
  const C = c.replace(/\s+/g, '');
  const findings = [];
  // B: 英語/フラグ漏れ
  const em = c.match(ENGLISH_WORDS); if (em) findings.push({ type:'english_leak', detail: em[0] });
  const fm = c.match(FLAG_RAW); if (fm) findings.push({ type:'flag_raw_leak', detail: fm[0] });
  // A: legacyにある数値がcomposeに無い
  const nums = new Set(); let nm;
  while ((nm = NUM_RE.exec(L)) !== null) {
    const n = nm[0]; if (!C.includes(n.replace(/\s/g,''))) nums.add(n.replace(/\s/g,''));
  }
  NUM_RE.lastIndex = 0;
  if (nums.size) findings.push({ type:'missing_number', detail: [...nums].join(',') });
  // C: 頻出名詞抜け(legacyにあってcomposeに無い)
  const kws = KEYWORDS.filter(k => L.includes(k) && !C.includes(k));
  if (kws.length) findings.push({ type:'missing_keyword', detail: kws.join(',') });
  // D: 長文verbatim一致
  if (L.length >= 15 && C.length >= 15) {
    for (let len = Math.min(L.length, 40); len >= 15; len--) {
      let hit = null;
      for (let i = 0; i + len <= L.length; i++) {
        const sub = L.slice(i, i+len);
        if (C.includes(sub)) { hit = sub; break; }
      }
      if (hit) { findings.push({ type:'verbatim_copy', detail: hit.slice(0,30) + (hit.length>30?'…':'') }); break; }
    }
  }
  if (findings.length) out.push({ key: m.key, name: m.name, legacy: L, compose: C, findings });
}

// kindごとに集計
const byKind = {};
for (const m of Object.values(WAZA_MAP)) {
  const r = out.find(o => o.key === m.key); if (!r) continue;
  const eff = (m.battle_data && m.battle_data.effects) || [];
  const kinds = [...new Set(eff.map(e => e.kind))];
  for (const k of kinds) { byKind[k] = (byKind[k]||0) + 1; }
}

process.stdout.write(JSON.stringify({
  total_moves_scanned: Object.values(WAZA_MAP).filter(m => ((m.battle_data&&m.battle_data.effects)||[]).length).length,
  flagged_moves: out.length,
  by_kind: Object.entries(byKind).sort((a,b)=>b[1]-a[1]),
  findings: out,
}, null, 2));
