#!/usr/bin/env node
// i18n 監査ハーネス: 各ページ×各言語をブラウザで開き、残った日本語(テキスト+ツールチップ属性)を検出。
// 使い方: node tools/i18n_audit_playwright.js [lang1,lang2,...] [--page=foo.html] [--strict]
//   例: node tools/i18n_audit_playwright.js en
//       node tools/i18n_audit_playwright.js en,fr,ko
//       node tools/i18n_audit_playwright.js en,ko,zh-Hans --strict
// 前提: ローカルサーバが http://127.0.0.1:8000 で稼働中。
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8000';
const PAGES = [
  'index.html', 'pokemon_db_v9.html', 'party_checker.html', 'waza-list.html', 'items_list.html',
  'type_chart.html', 'news.html', 'battle_simulator.html', 'real_battle.html', 'online_battle.html', 'real_battle_simulator.html',
  'how_to_use.html', 'db_guide.html', 'builder_guide.html', 'making.html', 'sitemap.html',
  'contact.html', 'privacy.html', 'terms.html', 'disclaimer.html',
  'suggest_partner.html',
  // 全国版・全部入りページ
  'pokemon_db_all.html', 'pokemon_db_all_v9.html',
  'waza-list_all.html',
  'ability_all.html',
  'items_db_all.html',
  'moves_db_all.html',
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
  /^もらいびこんじょう$/, // is_original 独自合成特性(もらいび+こんじょう)
  /^メガソーラー$/,      // Champions 独自特性(英名なし)
  /^ドラゴンスキン$/,    // Champions 独自特性(英名なし)
  /^しぜんかいふくどくのトゲ$/, // is_original 独自合成特性
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

const argLangs = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].split(',') : ['en'];
const onlyPage = (process.argv.find(a => a.startsWith('--page=')) || '').split('=')[1];
const strictMode = process.argv.includes('--strict');
const pages = onlyPage ? [onlyPage] : PAGES;

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

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const lang of argLangs) {
    report[lang] = {};
    const ctx = await browser.newContext();
    await ctx.addInitScript((l) => { try { localStorage.setItem('pchamdb.lang', l); } catch (e) {} }, lang);
    const page = await ctx.newPage();
    for (const pg of pages) {
      try {
        // networkidle待ちは大量lazy画像+リモートフォールバックのページ(全国図鑑等)で収束せず
        // タイムアウト誤検出(残日本語1件フレーク)になる → i18n適用完了フラグ(__i18nReady)を直接待つ(2026-07-05)
        await page.goto(BASE + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => window.__i18nReady === true, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(900); // 動的描画の残り(バトルログ等)待ち
        const raw = await page.evaluate(scanFn, lang);
        const leaks = applyAllowlist(raw);
        report[lang][pg] = leaks;
        const tag = leaks.length === 0 ? 'OK ' : leaks.length + '件';
        console.log(`[${lang}] ${pg.padEnd(30)} ${tag}`);
      } catch (e) {
        report[lang][pg] = [{ text: 'ERROR: ' + e.message.slice(0, 60), where: 'load' }];
        console.log(`[${lang}] ${pg.padEnd(28)} LOAD ERR`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  const fs = require('fs');
  const path = require('path');
  const reportJson = JSON.stringify(report, null, 1);
  // 出力先1: /tmp
  fs.writeFileSync('/tmp/i18n_audit_report.json', reportJson);
  // 出力先2: review/i18n_audit_latest.json (プロジェクトルート基準)
  const projectRoot = path.resolve(__dirname, '..');
  const reviewPath = path.join(projectRoot, 'review', 'i18n_audit_latest.json');
  fs.writeFileSync(reviewPath, reportJson);
  // サマリ
  console.log('\n=== サマリ(言語別 総残日本語件数) ===');
  let totalAll = 0;
  for (const lang of argLangs) {
    const total = Object.values(report[lang]).reduce((s, a) => s + a.length, 0);
    const pagesWith = Object.values(report[lang]).filter((a) => a.length).length;
    console.log(`  ${lang}: ${total}件 / ${pagesWith}ページ`);
    totalAll += total;
  }
  console.log('詳細: /tmp/i18n_audit_report.json');
  console.log('詳細: review/i18n_audit_latest.json');
  if (strictMode) {
    let strictTotal = 0;
    for (const lang of argLangs) {
      for (const [pg, leaks] of Object.entries(report[lang])) {
        if (!STRICT_SKIP_PAGES.includes(pg)) {
          strictTotal += leaks.length;
        }
      }
    }
    if (STRICT_SKIP_PAGES.length > 0) {
      console.log('[STRICT] 除外ページ: ' + STRICT_SKIP_PAGES.join(', '));
    }
    if (strictTotal > 0) {
      console.error('\n[STRICT] 残日本語 ' + strictTotal + '件 → exit 1');
      process.exit(1);
    } else {
      console.log('\n[STRICT] 残日本語 0件 → OK');
    }
  }
})();
