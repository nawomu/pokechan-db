#!/usr/bin/env node
'use strict';
// node --test tools/_browser_audit_test.js
// ブラウザI/Oを代役にした判定器の回帰。実画面の合格を意味しない。
// ページadapter/PokeDBの検査にはリポジトリの実コードとmasterを読み込む。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { auditPage, summarize } = require('./i18n_audit_playwright');
const views = require('./_views_pdca_playwright');
const ROOT = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function response(status, resourceType = 'document', url = 'http://127.0.0.1:8000/example.html') {
  return { status: () => status, ok: () => status >= 200 && status < 300, url: () => url,
    request: () => ({ resourceType: () => resourceType }) };
}

class PageDouble extends EventEmitter {
  constructor({ status = 200, ready = true, dbReady, findings = [], events = [], snapshot } = {}) {
    super();
    this.status = status; this.findings = findings; this.events = events; this.snapshot = snapshot;
    this.window = { __i18nReady: ready };
    if (dbReady) this.window.PokeDB = { ready: dbReady };
    this.context = vm.createContext({ window: this.window });
    this.scanned = false;
  }
  async goto() {
    const r = response(this.status);
    this.emit('response', r);
    for (const [event, value] of this.events) this.emit(event, value);
    return r;
  }
  async waitForFunction(fn, arg, { timeout }) {
    // 本物と同じ3引数契約を検査(旧ゲートはtimeoutをargに渡していた)。
    assert.equal(arg, null);
    const deadline = Date.now() + timeout;
    while (true) {
      const value = vm.runInContext('(' + fn.toString() + ')()', this.context);
      let timer;
      try {
        if (await Promise.race([value, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('ready timeout')), Math.max(1, deadline - Date.now()));
        })])) return;
      } finally { clearTimeout(timer); }
      if (Date.now() >= deadline) throw new Error('ready timeout');
      await pause(1);
    }
  }
  async waitForTimeout() {}
  async evaluate() { this.scanned = true; return this.snapshot || this.findings; }
  async addInitScript() {}
  async screenshot() {}
}

async function audit(options = {}) {
  const page = new PageDouble(options);
  const findings = await auditPage(page, 'http://127.0.0.1:8000/example.html', 'en', { timeout: 40, settleMs: 0 });
  assert.equal(page.eventNames().length, 0, 'リスナーを次ページへ残さない');
  return { findings, page, result: summarize({ en: { 'example.html': findings } }, true) };
}

test('正常な英語ページは合格する', async () => {
  const { result, page } = await audit();
  assert.equal(result.exitCode, 0); assert.equal(page.scanned, true);
});
test('日本語のないHTTP 404/500を成功にしない', async () => {
  for (const status of [404, 500]) {
    const { result, page } = await audit({ status });
    assert.equal(result.exitCode, 1); assert.equal(result.leaks, 0);
    assert.equal(page.scanned, false);
  }
});
test('i18n初期化タイムアウトを握りつぶさない', async () => {
  const { result, page } = await audit({ ready: false });
  assert.equal(result.exitCode, 1); assert.equal(page.scanned, false);
});
test('master失敗を日本語0の成功にしない', async () => {
  const dbReady = Promise.reject(new Error('master/pokemon.json (HTTP 404)'));
  dbReady.catch(() => {});
  const { result } = await audit({ dbReady });
  assert.equal(result.exitCode, 1);
});
test('masterが未解決なら空画面を走査せずタイムアウトする', async () => {
  const { result, page } = await audit({ dbReady: new Promise(() => {}) });
  assert.equal(result.exitCode, 1); assert.equal(page.scanned, false);
});
test('i18nが先に準備できてもmasterの遅延完了を待つ', async () => {
  let resolved = false;
  const dbReady = pause(10).then(() => { resolved = true; });
  const { result } = await audit({ dbReady });
  assert.equal(resolved, true); assert.equal(result.exitCode, 0);
});
test('JS例外があれば日本語0でも非strictモードで失敗する', async () => {
  const { findings } = await audit({ events: [['pageerror', new Error('render failed')]] });
  assert.equal(summarize({ en: { 'example.html': findings } }, false).exitCode, 1);
});
test('翻訳辞書/スクリプト/スタイルのHTTP失敗を検出する', async () => {
  for (const type of ['fetch', 'script', 'stylesheet']) {
    const { result } = await audit({ events: [['response', response(404, type)]] });
    assert.equal(result.exitCode, 1);
  }
});
test('接続断はHTTPレスポンスがなくても失敗する', async () => {
  const req = { url: () => 'http://127.0.0.1:8000/master/pokemon.json', resourceType: () => 'fetch',
    failure: () => ({ errorText: 'net::ERR_CONNECTION_RESET' }) };
  const { result } = await audit({ events: [['requestfailed', req]] });
  assert.equal(result.exitCode, 1);
});
test('画像の404は翻訳の失敗と混同しない', async () => {
  const { result } = await audit({ events: [['response', response(404, 'image')]] });
  assert.equal(result.exitCode, 0);
});
test('両ゲートは外部通信だけを除外し、同一originのHTTP失敗・abortとJS例外を検出する', async () => {
  const expected = views.loadExpected(), pg = views.PAGES.find(p => p.url === 'items_list.html');
  const snapshot = { n: expected['items-house'].length, names: expected['items-house'].map(i => i.name) };
  for (const origin of ['https://external.example', 'http://127.0.0.1:8000']) {
    const url = origin + '/script.js';
    const req = { url: () => url, resourceType: () => 'script', failure: () => ({ errorText: 'net::ERR_ABORTED' }) };
    for (const event of [['response', response(503, 'script', url)], ['requestfailed', req]]) {
      const events = [event], external = origin === 'https://external.example';
      assert.equal((await audit({ events })).result.exitCode, external ? 0 : 1);
      const view = await views.auditViewPage(new PageDouble({ snapshot, events }), pg, expected, { settleMs: 0 });
      assert.equal(view.ok, external);
    }
  }
  const events = [['pageerror', new Error('https://external.example/script.js: runtime failure')]];
  assert.equal((await audit({ events })).result.exitCode, 1);
  assert.equal((await views.auditViewPage(new PageDouble({ snapshot, events }), pg, expected, { settleMs: 0 })).ok, false);
});
test('real_battleは外側のglobal無しでもiframeの持ち物を全件照合する', () => {
  const expected = views.loadExpected(), pg = views.PAGES.find(p => p.url === 'real_battle.html');
  const frame = { contentWindow: {} };
  const context = vm.createContext({
    window: {}, POKEMON_LIST: expected['pokemon-ch'],
    document: { getElementById: id => id === 'engine-frame' ? frame : null },
  });
  assert.equal(Boolean(vm.runInContext(pg.wait, context)), false, 'iframeの準備前は待機する');
  const probe = () => clone(vm.runInContext('{' + pg.probe + '}', context));
  const before = probe();
  assert(views.checkSnapshot(pg, before, expected).some(e => e.startsWith('持ち物:')));
  frame.contentWindow.ITEMS_DATABASE = { items: expected['items-house'] };
  assert.equal(Boolean(vm.runInContext(pg.wait, context)), true);
  assert.deepEqual(views.checkSnapshot(pg, probe(), expected), []);
  frame.contentWindow.ITEMS_DATABASE.items = expected['items-house'].slice(1);
  assert(views.checkSnapshot(pg, probe(), expected).some(e => e.startsWith('持ち物:')));
});
test('既存の翻訳例外は残るがHTTP/JSエラーを除外しない', () => {
  const leak = { text: '未翻訳', where: 'span' };
  assert.equal(summarize({ en: { 'waza-list_all.html': [leak] } }, true).exitCode, 0);
  for (const kind of ['http', 'runtime', 'load']) {
    assert.equal(summarize({ en: { 'waza-list_all.html': [{ kind, text: 'ERROR' }] } }, true).exitCode, 1);
  }
  assert.equal(summarize({ en: { 'pokemon_db.html': [leak] } }, true).exitCode, 1);
  assert.equal(summarize({ en: { 'pokemon_db.html': [leak] } }, false).exitCode, 0);
});
test('通常ページの翻訳漏れはstrictモードで失敗する', async () => {
  const { result } = await audit({ findings: [{ text: 'こうげき', where: 'span' }] });
  assert.equal(result.exitCode, 1); assert.equal(result.leaks, 1); assert.equal(result.errors, 0);
});

test('段Dは昇格したポケモンDB2ページを含み、転送スタブを検査しない', () => {
  const pages = views.PAGES.map(p => p.url);
  assert(pages.includes('pokemon_db.html')); assert(pages.includes('pokemon_db_all.html'));
  assert(!pages.includes('pokemon_db_v9.html')); assert(!pages.includes('pokemon_db_all_v9.html'));
  assert.equal(pages.length, 8);
  for (const pg of pages) assert(fs.existsSync(path.join(ROOT, pg)), pg);
});
test('名簿の全件照合は同じ件数の入れ替え・重複・空配列も落とす', () => {
  const expected = [{ name: 'a' }, { name: 'b' }];
  for (const actual of [['a', 'c'], ['a', 'a'], [], undefined]) assert(views.compareRoster(actual, expected).length > 0);
  assert.equal(views.compareRoster(['b', 'a'], expected).length, 0);
  assert(views.compareRoster(['b', 'a'], expected, true).length > 0);
});

async function loadPokemonAdapter(pageName) {
  const script = { src: 'http://127.0.0.1:8000/pokedb.js', getAttribute: () => null };
  const context = vm.createContext({
    window: {}, document: { currentScript: script, querySelectorAll: () => [{}] },
    URLSearchParams, location: { search: '' },
    fetch: async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'master', path.basename(url)), 'utf8')) }),
    // DOM初期化は本テストの対象外。adapterが使う処理だけを明示的にstub化する。
    _buildWazaMaster: () => [], _buildFnGroups: () => [{}, {}],
    _buildDataDependentColumns() {}, _buildMegaCapableNos() {}, setupWazaHoverTip() {}, maybeInit() {},
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'pokedb.js'), 'utf8'), context);
  context.PokeDB = context.window.PokeDB;
  await context.PokeDB.ready;
  const html = fs.readFileSync(path.join(ROOT, pageName), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const adapter = scripts.find(s => /^\s*PokeDB.ready.then\(function/.test(s));
  assert(adapter, 'ページの実adapterが存在する');
  vm.runInContext(adapter, context);
  await pause(0);
  const pg = views.PAGES.find(p => p.url === pageName);
  return { context, pg, snapshot: clone(vm.runInContext(pg.probe, context)) };
}

for (const pageName of ['pokemon_db.html', 'pokemon_db_all.html']) {
  test(pageName + ': 実PokeDB+実adapterをmaster全件と照合(描画は対象外)', async () => {
    const { pg, snapshot } = await loadPokemonAdapter(pageName);
    const expected = views.loadExpected();
    assert.deepEqual(views.checkSnapshot(pg, snapshot, expected), []);
    for (let stat = 1; stat <= 6; stat++) {
      const bad = clone(snapshot); bad.stats[0][stat]++;
      assert(views.checkSnapshot(pg, bad, expected).includes('種族値の全件照合不一致'));
    }
    const blank = clone(snapshot); blank.rendered = 0;
    assert(views.checkSnapshot(pg, blank, expected).length > 0);
  });
}

test('段Dの実行経路が正しいprobe結果でもJSエラーを落とす', async () => {
  const expected = views.loadExpected();
  const pg = views.PAGES.find(p => p.url === 'items_list.html');
  const snapshot = { n: expected['items-house'].length, names: expected['items-house'].map(i => i.name) };
  for (const broken of [false, true]) {
    const page = new PageDouble({ snapshot, events: broken ? [['pageerror', new Error('broken')]] : [] });
    const result = await views.auditViewPage(page, pg, expected, { settleMs: 0 });
    assert.equal(result.ok, !broken);
    assert.equal(page.eventNames().length, 0);
  }
});
test('段Dは保存失敗をスクリーンショット確認済みにしない', async () => {
  const expected = views.loadExpected(), pg = views.PAGES.find(p => p.url === 'items_list.html');
  const page = new PageDouble({ snapshot: { n: expected['items-house'].length, names: expected['items-house'].map(i => i.name) } });
  page.screenshot = async () => { throw new Error('disk full'); };
  const result = await views.auditViewPage(page, pg, expected, { outdir: '/tmp', settleMs: 0 });
  assert.equal(result.ok, false);
  assert(result.errors.some(e => e.text === 'disk full'));
});

async function runI18nCliWithDouble(args, options) {
  const writes = new Map();
  let closedPages = 0, closedContexts = 0, closedBrowsers = 0;
  const browser = {
    newContext: async () => ({
      addInitScript: async () => {},
      newPage: async () => Object.assign(new PageDouble(options), { close: async () => { closedPages++; } }),
      close: async () => { closedContexts++; },
    }),
    close: async () => { closedBrowsers++; },
  };
  const context = vm.createContext({
    module: { exports: {} }, __dirname,
    console: { log() {}, error() {} },
    require: name => name === 'playwright' ? { chromium: { launch: async () => browser } } :
      name === 'fs' ? { mkdirSync() {}, writeFileSync: (p, s) => writes.set(p, s) } : require(name),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'i18n_audit_playwright.js'), 'utf8'), context);
  const code = await context.module.exports.main(args);
  return { code, writes, closedPages, closedContexts, closedBrowsers };
}

test('CLI: HTTP 404はstrict指定の有無に関係なくexit 1・独立した出力に記録する', async () => {
  for (const strict of [[], ['--strict']]) {
    const result = await runI18nCliWithDouble(['en', '--page=waza-list_all.html', '--out=/tmp/audit-test-report.json', ...strict], { status: 404 });
    assert.equal(result.code, 1);
    assert.deepEqual([...result.writes.keys()], ['/tmp/audit-test-report.json']);
    const findings = JSON.parse(result.writes.get('/tmp/audit-test-report.json')).en['waza-list_all.html'];
    assert(findings.some(f => f.kind === 'http'));
    assert.equal(result.closedPages, 1); assert.equal(result.closedContexts, 1); assert.equal(result.closedBrowsers, 1);
  }
});
test('CLI: 2言語でページを独立作成し、既定の出力形式を維持する', async () => {
  const result = await runI18nCliWithDouble(['en,fr', '--page=pokemon_db.html', '--strict'], {});
  assert.equal(result.code, 0); assert.equal(result.closedPages, 2); assert.equal(result.closedContexts, 2);
  assert.equal(result.writes.size, 2);
  assert.deepEqual(JSON.parse(result.writes.get('/tmp/i18n_audit_report.json')), {
    en: { 'pokemon_db.html': [] }, fr: { 'pokemon_db.html': [] },
  });
});
