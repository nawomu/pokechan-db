#!/usr/bin/env node
// i18n 監査ハーネス: 各ページ×各言語をブラウザで開き、残った日本語(テキスト+ツールチップ属性)を検出。
// 使い方: node tools/i18n_audit_playwright.js [lang1,lang2,...] [--page=foo.html] [--strict] [--out=report.json]
//   例: node tools/i18n_audit_playwright.js en
//       node tools/i18n_audit_playwright.js en,fr,ko
//       node tools/i18n_audit_playwright.js en,ko,zh-Hans --strict
// 前提: ローカルサーバが http://127.0.0.1:8000 で稼働中。
const { observePage, openReadyPage } = require('./_lib/browser_audit');

const BASE = 'http://127.0.0.1:8000';
const PAGES = [
  'index.html', 'pokemon_db.html', 'party_checker.html', 'waza-list.html', 'items_list.html',
  'type_chart.html', 'news.html', 'battle_simulator.html', 'real_battle.html', 'online_battle.html', 'real_battle_simulator.html',
  'how_to_use.html', 'db_guide.html', 'builder_guide.html', 'making.html', 'sitemap.html',
  'contact.html', 'privacy.html', 'terms.html', 'disclaimer.html',
  'suggest_partner.html',
  // 全国版・全部入りページ
  'pokemon_db_all.html',
  'waza-list_all.html',
  'ability_all.html',
  'items_db_all_v2.html',
];

// 意図的に日本語を残す許可パターン (正規表現)
const ALLOWLIST = [
  /ポケモンチャンネル/,   // サイト名
  /ヤックン/,             // キャラクター名
  /pchamdb\.com/,         // ドメイン
  /ポケモン/,             // ブランド名
  // ── Champions 独自ポケモン: 2026-07-03 に合成名(name_synthesized)を導入し多言語名が
  //    i18n 辞書に入ったため、ALLOWLIST から削除(残 ja 表示=本物の漏れとして検出する)。
  //    合成規約: build_master.js の MEGA_PREFIX / synthMegaNames / synthFormNames 参照。
  // ── Champions 独自特性: 公式PokeAPIに英名なし・またはマスター未登録のChampions固有とくせい。
  /^うなぎのぼり$/,      // マスター未登録の独自特性(reference/master_abilities.json 外)
  /^ほのおのたてがみ$/,  // マスター未登録の独自特性(reference/master_abilities.json 外)
  /^メガソーラー$/,      // Champions 独自特性(英名なし)
  /^ドラゴンスキン$/,    // Champions 独自特性(英名なし)
  /^かんつうドリル$/,    // Champions 独自特性(英名なし)
  /^とびだすハバネロ$/,  // Champions 独自特性(英名なし)
  // ── サイト固有の固有名詞: 外国語翻訳先でも ja 名のままが意図的な固有名詞。
  /ぴ〜ちゃん/,          // サイトオリジナルキャラクター名(terms.html等のコピーライト文中でも ja 固定)
  // ── Shadow技 18件: i18n/en.json に slug 未登録(翻訳WFが別スレッドで追加予定)。
  //    moves_master.json には EN 名あり(Shadow Rush/Blast 等)。WF完了後に外す。
  /^ダークラッシュ$/, /^ダークブラスト$/, /^ダークアタック$/, /^ダークサンダー$/,
  /^ダークブレイク$/, /^ダークフリーズ$/, /^ダークエンド$/, /^ダークファイア$/,
  /^ダークレイブ$/, /^ダークストーム$/, /^ダークウェーブ$/, /^ダークダウン$/,
  /^ダークハーフ$/, /^ダークホールド$/, /^ダークミスト$/, /^ダークパニック$/,
  /^ダークリムーブ$/, /^ダークウェザー$/,
];

// --strict モードで集計から除外するページ (既知の構造的未対応)
const STRICT_SKIP_PAGES = [
  'waza-list_all.html',   // 技説明文descが辞書未登録(段階的対応中)
];

// 許可リストに一致するテキストを除外する
function applyAllowlist(findings) {
  // セレクトボタン等の末尾装飾(▾/▼)を剥がしてから許可リスト照合(例:「もらいびこんじょう ▾」=独自特性+開閉マーク)
  return findings.filter(f => { const t = String(f.text).replace(/[  ]*[▾▼]$/, ''); return !ALLOWLIST.some(re => re.test(t)); });
}

// ページ内で実行: 日本語が残ったテキスト/属性を収集(data-i18n-audit-skip は除外)
function scanFn(lang) {
  const JA = (lang === 'zh-Hans' || lang === 'zh-Hant') ? /[ぁ-ゖァ-ヺ]/ : /[ぁ-ゖァ-ヺ一-龯]/; // 中国語は漢字を共有するためzhはかなのみ検出
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
  const out = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || skipTags.has(el.tagName)) continue;
    if (el.closest('[data-i18n-audit-skip]') || el.closest('.i18n-switcher') || el.closest('.copyright') || el.closest('.site-footer') || el.classList.contains('copyright') || el.closest('[aria-label*="広告"]') || el.tagName==='IFRAME' || /日本語|简体中文|繁體中文|한국어|Español|Français|Deutsch|Italiano/.test((n.textContent||'').trim())) continue;
    const t = (n.textContent || '').trim();
    if (!t || !JA.test(t)) continue;
    const k = t.slice(0, 60);
    if (seen.has(k)) continue; seen.add(k);
    out.push({ text: k, where: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : '') });
  }
  document.querySelectorAll('[title],[data-desc],[placeholder],[aria-label]').forEach((el) => {
    if (el.closest('[data-i18n-audit-skip]') || el.closest('.i18n-switcher') || el.closest('.copyright') || el.closest('.site-footer') || el.closest('[aria-label*="広告"]') || el.tagName==='IFRAME' || (el.getAttribute('title')||'').includes('広告')) return;
    ['title', 'data-desc', 'placeholder', 'aria-label'].forEach((a) => {
      const v = el.getAttribute(a);
      if (!v || !JA.test(v)) return;
      const k = '@' + a + ':' + v.slice(0, 50);
      if (seen.has(k)) return; seen.add(k);
      out.push({ text: '[' + a + '] ' + v.slice(0, 55), where: el.tagName.toLowerCase() });
    });
  });
  return out;
}

// HTTP/実行時/初期化の失敗はallowlistやSTRICT_SKIP_PAGESで除外しない。
// 外部通信・画像・フォントは翻訳監査の対象外。同一originのscript/fetch/stylesheet/documentの失敗を記録する。
async function auditPage(page, url, lang, { timeout = 20000, settleMs = 900 } = {}) {
  const observed = observePage(page, {
    origin: url,
    ignoreResponse: r => ['image', 'font', 'media'].includes(r.request().resourceType()),
  });
  let leaks = [];
  try {
    await openReadyPage(page, url, { timeout });
    await page.waitForTimeout(settleMs);
    leaks = applyAllowlist(await page.evaluate(scanFn, lang));
  } catch (e) {
    observed.add('load', 'ERROR: ' + e.message);
  } finally {
    observed.dispose();
  }
  return [...observed.errors, ...leaks];
}

function summarize(report, strictMode) {
  let errors = 0, leaks = 0, strictLeaks = 0;
  for (const pages of Object.values(report)) {
    for (const [pg, findings] of Object.entries(pages)) {
      for (const finding of findings) {
        if (finding.kind) errors++;
        else {
          leaks++;
          if (!STRICT_SKIP_PAGES.includes(pg)) strictLeaks++;
        }
      }
    }
  }
  return { errors, leaks, strictLeaks, exitCode: errors > 0 || (strictMode && strictLeaks > 0) ? 1 : 0 };
}

async function main(args = process.argv.slice(2)) {
  const langs = args[0] && !args[0].startsWith('--') ? args[0].split(',') : ['en'];
  const option = key => args.find(a => a.startsWith(key + '='))?.slice(key.length + 1);
  const onlyPage = option('--page');
  const strictMode = args.includes('--strict');
  const pages = onlyPage ? [onlyPage] : PAGES;
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const report = {};
  try {
    for (const lang of langs) {
      report[lang] = {};
      const ctx = await browser.newContext();
      try {
        await ctx.addInitScript((l) => { localStorage.setItem('pchamdb.lang', l); }, lang);
        for (const pg of pages) {
          // ページごとに作り直し、前ページの遅延エラー/readyフラグを引き継がない。
          const page = await ctx.newPage();
          try {
            const findings = await auditPage(page, BASE + '/' + pg, lang);
            report[lang][pg] = findings;
            const errors = findings.filter(f => f.kind).length;
            const leaks = findings.length - errors;
            const tag = errors ? `ERROR ${errors}件 / 残日本語 ${leaks}件` : leaks ? leaks + '件' : 'OK';
            console.log(`[${lang}] ${pg.padEnd(30)} ${tag}`);
          } finally {
            await page.close();
          }
        }
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  const fs = require('fs');
  const path = require('path');
  const reportJson = JSON.stringify(report, null, 1);
  // --out指定時は指定先だけに出し、故障注入テストがlatestを上書きしないようにする。
  const destinations = option('--out') ? [path.resolve(option('--out'))] :
    ['/tmp/i18n_audit_report.json', path.resolve(__dirname, '../review/i18n_audit_latest.json')];
  for (const destination of destinations) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, reportJson);
  }
  // サマリ
  console.log('\n=== サマリ(言語別 総残日本語件数) ===');
  for (const lang of langs) {
    const total = Object.values(report[lang]).reduce((s, a) => s + a.filter(f => !f.kind).length, 0);
    const pagesWith = Object.values(report[lang]).filter(a => a.some(f => !f.kind)).length;
    console.log(`  ${lang}: ${total}件 / ${pagesWith}ページ`);
  }
  destinations.forEach(destination => console.log('詳細: ' + destination));
  const result = summarize(report, strictMode);
  console.log(`読込・実行エラー: ${result.errors}件`);
  if (strictMode) console.log(`[STRICT] 残日本語 ${result.strictLeaks}件 (残日本語のみ除外: ${STRICT_SKIP_PAGES.join(', ')})`);
  console.log(`exit ${result.exitCode}`);
  return result.exitCode;
}

module.exports = { PAGES, auditPage, scanFn, applyAllowlist, summarize, main };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(e => {
  console.error('❌ i18n監査を完了できません: ' + e.message);
  process.exitCode = 1;
});
