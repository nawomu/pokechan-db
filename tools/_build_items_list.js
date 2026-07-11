#!/usr/bin/env node
// items_database.js から items_list.html を生成(2026-06-19 阿部さん依頼)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function lit(t, m, start = '{') {
  const at = t.indexOf(m); let i = t.indexOf(start, at), s = i, d = 0, S = false, e = false;
  for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === start) d++; else if (c === (start === '{' ? '}' : ']')) { d--; if (d === 0) return t.slice(s, i + 1); } } }
}
// items_database.json (元データ) から直接読み込む方が安全
const db = JSON.parse(fs.readFileSync(path.join(ROOT, '_review/items_database.json'), 'utf8'));
const items = db.items;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CAT_LABEL = db.categories;
const CAT_ORDER = ['attack_boost', 'type_boost', 'berry_resist', 'berry_status_cure', 'berry_hp_cure', 'defense_boost', 'status_inflict', 'hp_drain', 'speed_boost', 'survival', 'misc', 'mega_stone'];

// MB追加分(2026-06-19反映)
const MB_NEW_KEYS = new Set([
  'mega_stone_raichu_x', 'mega_stone_raichu_y', 'mega_stone_sceptile', 'mega_stone_blaziken',
  'mega_stone_swampert', 'mega_stone_mawile', 'mega_stone_metagross', 'mega_stone_staraptor',
  'mega_stone_scolipede', 'mega_stone_scrafty', 'mega_stone_eelektross', 'mega_stone_pyroar',
  'mega_stone_malamar', 'mega_stone_barbaracle', 'mega_stone_dragalge', 'mega_stone_falinks',
  'metronome', 'ooki_na_nekko', 'koukaku_lens', 'focus_lens', 'hikari_no_nendo',
  'atsui_iwa', 'sarasara_iwa', 'shimetta_iwa', 'tsumetai_iwa', 'kireina_nukegara', 'kuroi_tekkyu',
  'life_orb', 'expert_belt', 'muscle_band', 'wise_glasses'   // 2026-07-11 レギュMBショップ追加を確認(ヤックン)
]);

// レギュMBショップ追加4件: 🆕バッジ+versionTagは出すが row-new(黄塗)にはしない(現行items_list.htmlに合わせる)
const SHOP_NEW_KEYS = new Set(['life_orb', 'expert_belt', 'muscle_band', 'wise_glasses']);

// 非メガアイテムの applies_to: JSONには英語キー(damage等)で入っている(2026-07-11実測)。
// キー→JAラベルの逆引きで data-i18n="items_list.applies.<key>" + インラインJA を出す(現行ページと同型)。
// メガストーン等ポケモン名(カタカナ)の applies_to は data-poke-ja でポケモン名翻訳。
const APPLIES_JA = {
  damage: 'ダメージ',
  physical_attack: 'こうげき(物理わざ)',
  special_attack: 'とくこう(特殊わざ)',
  super_effective_damage: 'こうかばつぐんのダメージ',
  physical_damage: '物理わざのダメージ',
  special_damage: '特殊わざのダメージ',
  punch_moves: 'パンチわざ',
  critical_rate: 'きゅうしょランク',
  defense_and_sp_defense: 'ぼうぎょ・とくぼう',
  special_defense: 'とくぼう',
  evasion: 'かいひりつ',
  speed: 'すばやさ',
};

const byCat = {};
for (const it of items) { (byCat[it.category] = byCat[it.category] || []).push(it); }

const sections = CAT_ORDER.filter(c => byCat[c]).map(c => {
  // ★2026-06-19 阿部さん指摘: フロンティアショップ入手のデフォルト + 追加バージョンの明示
  const acqLabel = (it) => {
    if (it.acquisition_note) return it.acquisition_note;
    const a = it.acquisition;
    if (a === 'frontier_shop_2000VP') return 'フロンティアショップ 2,000VP';
    if (a === 'frontier_shop_1000VP') return 'フロンティアショップ 1,000VP';
    if (a === 'frontier_shop_700VP') return 'フロンティアショップ 700VP';
    if (a === 'frontier_shop') return 'フロンティアショップ';
    if (a === 'tutorial_free') return 'バトルチュートリアル報酬 (無料)';
    if (a === 'za_link') return 'ポケモンZA連携 (HOME 経由)';
    if (a === 'season_m1_reward') return 'シーズン M-1 報酬';
    if (a === 'season_m1_or_giveaway') return 'シーズン M-1 報酬 / ふしぎな贈り物配布';
    if (a === 'frontier_shop_2000VP_or_campaign') return 'フロンティアショップ 2,000VP / キャンペーン無料配布';
    // 入手情報なし: メガストーンならフロンティアショップ推定、その他は不明
    if (it.category === 'mega_stone') return 'フロンティアショップ(推定)';
    return '不明';
  };
  const arr = byCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  const rows = arr.map(it => {
    const isNew = MB_NEW_KEYS.has(it.key);
    const isRowNew = isNew && !SHOP_NEW_KEYS.has(it.key);   // ショップ追加4件は🆕バッジのみ(row-new黄塗なし)
    const versionTag = isNew ? ` <span class="tag-version" data-i18n="items_list.tag_version_mb">M-Bで追加</span>` : '';
    // アイテム名は runtime で I18N.item() 翻訳(data-item-ja)。タグ類は別要素に分離。
    const nameSpan = `<span data-item-ja="${esc(it.name)}">${esc(it.name)}</span>`;
    const nameCell = isNew ? `<b>${nameSpan}</b> <span class="tag-new">🆕</span>${versionTag}` : nameSpan;
    const effect = esc(it.effect || '');
    const acq = esc(acqLabel(it));
    // メガは対応ポケモン名を data-poke-ja で翻訳。非メガは applies_to(JA)→i18nキーで翻訳(未対応ならpoke-ja)。
    const applies = it.applies_to ? (() => {
      const inner = it.category === 'mega_stone'
        ? `<span data-poke-ja="${esc(it.applies_to)}">${esc(it.applies_to)}</span>`
        : (APPLIES_JA[it.applies_to]
          ? `<span data-i18n="items_list.applies.${it.applies_to}">${APPLIES_JA[it.applies_to]}</span>`
          : `<span data-poke-ja="${esc(it.applies_to)}">${esc(it.applies_to)}</span>`);
      return `<br><span class="applies"><span data-i18n="items_list.applies_prefix">対応:</span> ${inner}</span>`;
    })() : '';
    const factor = it.factor != null ? `×${it.factor}` : (it.q12 != null ? `(Q12: ${it.q12})` : '');
    return `<tr class="${isRowNew ? 'row-new' : ''}">
<td class="name">${nameCell}${applies}</td>
<td class="effect" data-itemdesc-ja="${esc(it.effect || '')}">${effect}</td>
<td class="factor">${factor}</td>
<td class="acq">${acq}</td>
</tr>`;
  }).join('\n');
  return `<section class="cat-sec" id="cat-${c}">
<h2><span class="cat-icon">${c === 'mega_stone' ? '✨' : '🎁'}</span> <span data-i18n="items_list.cat_${c}">${esc(CAT_LABEL[c] || c)}</span> <span class="count">${arr.length}件</span></h2>
<table>
<thead><tr><th class="th-name" data-i18n="items_list.th_name">アイテム名</th><th class="th-effect" data-i18n="items_list.th_effect">効果</th><th class="th-factor" data-i18n="items_list.th_factor">倍率</th><th class="th-acq" data-i18n="items_list.th_acq">入手</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</section>`;
}).join('\n');

const newCount = items.filter(it => MB_NEW_KEYS.has(it.key)).length;
const sumChips = CAT_ORDER.filter(c => byCat[c]).map(c =>
  `<a class="sum-chip" href="#cat-${c}">${esc(CAT_LABEL[c] || c)}<b>${byCat[c].length}</b></a>`
).join('');

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title data-i18n="items_list.page_title">🎁 持ち物一覧 - PchamDB</title>
<meta name="description" content="ポケモンチャンピオンズ全持ち物一覧。メガストーン・威力補正・天気延長・タイプ強化・状態異常付与・きのみ等カテゴリ別">
<meta name="theme-color" content="#FF7A00">
<link rel="canonical" href="https://pchamdb.com/items_list.html">
<link rel="icon" href="favicon.png" type="image/png">
<script defer src="i18n/runtime.js?v=20260703d"></script>
<style>
body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#f5f7fa;color:#222;font-size:14px;padding:0 0 60px}
.hdr{padding:14px 18px;background:linear-gradient(135deg,#FF7A00,#FFC107);color:#fff;position:sticky;top:0;z-index:50}
.hdr h1{font-size:18px;margin:0}
.hdr .sub{font-size:12px;color:#fff;margin-top:4px;opacity:.92}
.nav{padding:7px 18px;background:#1F4E79;color:#fff;display:flex;gap:10px;font-size:12px}
.nav a{color:#cfe0f0;text-decoration:none}.nav a:hover{color:#fff;text-decoration:underline}
.bar{padding:9px 18px;background:#eef3fa;border-bottom:1px solid #C5D2E5;display:flex;gap:6px;align-items:center;flex-wrap:wrap;position:sticky;top:var(--hdr-h,74px);z-index:40}
.bar input{padding:5px 12px;border-radius:8px;border:1px solid #C5D2E5;font-size:13px;width:220px}
.sum-chip{display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:#fff;background:#1F4E79;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700}
.sum-chip:hover{background:#FF7A00}
.sum-chip b{background:rgba(255,255,255,.25);padding:1px 6px;border-radius:8px}
.main{max-width:1200px;margin:0 auto;padding:14px 18px}
.cat-sec{background:#fff;border:1px solid #d6dee8;border-radius:10px;padding:14px 18px;margin-bottom:14px;box-shadow:0 2px 4px rgba(0,0,0,.04);overflow-x:auto;-webkit-overflow-scrolling:touch}
.cat-sec h2{margin:0 0 12px 0;font-size:16px;color:#1F4E79;display:flex;align-items:center;gap:8px;border-bottom:2px solid #FF7A00;padding-bottom:6px}
.cat-icon{font-size:18px}
.count{font-size:11px;background:#FF7A00;color:#fff;padding:2px 9px;border-radius:10px;font-weight:700;margin-left:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
thead{position:sticky;top:var(--sticky2,108px);background:#1F4E79;color:#fff;z-index:30}
thead th{padding:5px 8px;text-align:left;border-right:1px solid #173e63;font-size:11.5px;font-weight:700}
tbody td{padding:5px 8px;border-bottom:1px solid #EEE;vertical-align:top}
tbody tr:hover{background:#f3f6fb}
tbody tr:nth-child(2n){background:#fafbfd}
tbody tr.row-new{background:#FFFDE7}
tbody tr.row-new:hover{background:#FFF9C4}
.tag-new{display:inline-block;font-size:10px;background:#FF7A00;color:#fff;padding:1px 6px;border-radius:8px;font-weight:700;margin-left:4px}
.tag-version{display:inline-block;font-size:10px;background:#6A1B9A;color:#fff;padding:1px 7px;border-radius:8px;font-weight:700;margin-left:3px}
td.name{min-width:140px;font-weight:700;color:#1F4E79}
td.effect{font-size:12px;color:#33415c;max-width:400px}
td.factor{width:80px;font-family:monospace;color:#E65100;text-align:center}
td.acq{font-size:11.5px;color:#5d4037;min-width:120px}
.applies{display:inline-block;font-size:11px;color:#7a8aa0;font-weight:400}
.bn-cat{position:fixed;bottom:14px;right:14px;background:#FF7A00;color:#fff;text-decoration:none;padding:7px 13px;border-radius:24px;font-size:12.5px;box-shadow:0 3px 8px rgba(0,0,0,.25);font-weight:700}
.bn-cat:hover{background:#E65100}
.update-note{background:#FFFDE7;border-left:4px solid #FFC107;padding:8px 12px;margin-bottom:14px;font-size:12.5px;color:#5d4037}
.update-note b{color:#FF7A00}
</style></head><body>
<div class="hdr">
<h1 data-i18n="items_list.page_title">🎁 持ち物一覧 - PchamDB</h1>
<div class="sub" id="items-subtitle" data-tpl-count="${items.length}" data-tpl-date="" data-tpl-season="M-B" data-tpl-n="${newCount}">全 ${items.length} アイテム (レギュMBで <b>+${newCount}件</b> 追加 🆕)</div>
</div>
<div class="nav">
<a href="index.html">🏠 <span data-i18n="items_list.nav_top">トップ</span></a>
<a href="pokemon_db_v9.html">🗄️ <span data-i18n="items_list.nav_pokemon_db">ポケモンDB</span></a>
<a href="waza-list.html">📋 <span data-i18n="items_list.nav_waza">わざ一覧</span></a>
<a href="news.html">📰 <span data-i18n="items_list.nav_news">ニュース</span></a>
<a href="party_checker.html">🎯 <span data-i18n="items_list.nav_team_builder">チームビルダー</span></a>
</div>
<div class="bar">
<input id="q" placeholder="🔍 アイテム名・効果で絞り込み…" data-i18n-attr="placeholder:items_list.search_placeholder">
${sumChips}
</div>
<div class="main">
<div class="update-note">📅 <span data-i18n="items_list.update_note_text">メガストーン16種 + 通常持ち物11種 追加・1対戦でメガシンカ1度ルール・期間 2026/6/17〜9/2 10:59</span> (<a href="news.html" data-i18n="items_list.update_note_news_link">詳しくはニュース</a>)</div>
${sections}
</div>
<a href="#" class="bn-cat" data-i18n="items_list.btn_scroll_top">↑ トップへ</a>
<script>
const inp = document.getElementById('q');
const allRows = [...document.querySelectorAll('tbody tr')];
inp.addEventListener('input', () => {
  const q = inp.value.trim().toLowerCase();
  for (const r of allRows) {
    const txt = r.textContent.toLowerCase();
    r.style.display = !q || txt.includes(q) ? '' : 'none';
  }
});
// 入手列(td.acq)の合成編集文を表示翻訳するための辞書(ja句→各言語)。非同期ロード後に再適用。
let ACQ_TR = null;
(function loadAcqTr(){
  try { fetch('i18n/acq_i18n.json').then(r=>r.ok?r.json():null).then(d=>{ if(d){ ACQ_TR=d; if(window.I18N) applyItemI18n(); } }).catch(()=>{}); } catch(e){}
})();
// 持ち物名/効果/対応ポケモンを runtime で翻訳(I18N.item/itemDesc/pokemon)
function applyItemI18n() {
  if (!window.I18N) return;
  // 入手列: ja句を現在言語へ(辞書ロード済みかつ非ja時)。data-acq-ja(原文)を保持して再翻訳可能に。
  if (ACQ_TR && I18N.lang !== 'ja' && ACQ_TR[I18N.lang]) {
    const m = ACQ_TR[I18N.lang];
    document.querySelectorAll('td.acq').forEach(el => {
      const ja = el.getAttribute('data-acq-ja') || el.textContent.trim();
      if (!el.getAttribute('data-acq-ja')) el.setAttribute('data-acq-ja', ja);
      if (m[ja]) el.textContent = m[ja];
    });
  }
  document.querySelectorAll('[data-item-ja]').forEach(el => {
    el.textContent = I18N.item(el.getAttribute('data-item-ja'));
  });
  document.querySelectorAll('[data-itemdesc-ja]').forEach(el => {
    const fallback = el.getAttribute('data-itemdesc-ja');  // 効果の独自ja(jaモード/未訳時の表示)
    // I18N.itemDesc は「アイテム名(ja)」が引数。同じ行の名前セルから解決して効果文を多言語化。
    const row = el.closest('tr');
    const nameEl = row && row.querySelector('[data-item-ja]');
    const itemJa = nameEl && nameEl.getAttribute('data-item-ja');
    const t = itemJa ? I18N.itemDesc(itemJa) : null;
    el.textContent = t || fallback;
  });
  document.querySelectorAll('[data-poke-ja]').forEach(el => {
    el.textContent = I18N.pokemon(el.getAttribute('data-poke-ja'));
  });
  // サマリーチップ: href #cat-<id> から items_list.cat_<id> を引いて表示語を翻訳(件数<b>は温存)
  document.querySelectorAll('a.sum-chip[href^="#cat-"]').forEach(el => {
    const id = (el.getAttribute('href') || '').replace('#cat-', '');
    const label = I18N.t('items_list.cat_' + id, '');
    if (label && el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = label;
  });
  // 件数 "N件" → N + count_unit
  const unit = I18N.t('items_list.count_unit', '件');
  document.querySelectorAll('span.count').forEach(el => {
    const m = (el.textContent || '').match(/(\\d+)/);
    if (m) el.textContent = m[1] + unit;
  });
  // サブタイトル(プレースホルダ入りテンプレート)を補間
  const st = document.getElementById('items-subtitle');
  if (st) {
    const tpl = I18N.t('items_list.subtitle_template', null);
    if (tpl) {
      st.textContent = tpl
        .replace('{count}', st.getAttribute('data-tpl-count'))
        .replace('{date}', st.getAttribute('data-tpl-date'))
        .replace('{season}', st.getAttribute('data-tpl-season'))
        .replace('{n}', st.getAttribute('data-tpl-n'));
    }
  }
}
document.addEventListener('i18n:ready', applyItemI18n);
document.addEventListener('i18n:changed', applyItemI18n);
</script>
<script>
// sticky位置をヘッダー実測で動的算出(2026-07-03: ハードコードだと見出し変更で崩れる)
function _fixSticky(){var h=document.querySelector('.hdr'),b=document.querySelector('.bar');if(!h||!b)return;var hh=h.offsetHeight;document.documentElement.style.setProperty('--hdr-h',hh+'px');document.documentElement.style.setProperty('--sticky2',(hh+b.offsetHeight)+'px');}
window.addEventListener('DOMContentLoaded',_fixSticky);window.addEventListener('resize',_fixSticky);window.addEventListener('load',_fixSticky);
document.addEventListener('i18n:changed',function(){setTimeout(_fixSticky,50);});
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'items_list.html'), html);
console.log('生成: items_list.html / 全' + items.length + 'アイテム (新規 ' + newCount + ')');
