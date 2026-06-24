/* バトルログ多言語化(案X=表示時翻訳・演出は触らない)。
 * real_battle.html / real_battle_simulator.html の両方が読み込む共有モジュール。
 * - エンティティ(ポケ/技/特性/道具)は **ポケモンDBと共通の I18N(SSOT)** から訳す。
 * - 固定句は下の BATTLE_LOG_PATTERNS(パターン→言語別テンプレ)。
 * - 未対応パターンは ja をそのまま返す=フォールバック(壊れない)。演出は呼び元が ja msg を使うので無影響。
 * 依存: window.I18N(runtime.js)・window.WAZA_MAP(pokechan_data.js)。両方ロード後に使う。
 * ★段階導入: まず高頻度パターン+en。残りパターン・他言語は順次カタログに追加(並列WF)。
 */
(function (global) {
  'use strict';

  // 技名(ja)→ローマ字キー(I18N.move はキー要求)。初回アクセスで構築。
  var _moveKey = null;
  function moveKey(jaName) {
    if (!_moveKey) {
      _moveKey = {};
      // WAZA_MAP は const(非window)。bare名で参照(同一グローバル字句環境を共有)。
      var W = (typeof WAZA_MAP !== 'undefined') ? WAZA_MAP : (global.WAZA_MAP || null);
      if (W) for (var k in W) { if (W[k] && W[k].name) _moveKey[W[k].name] = W[k].key || k; }
    }
    return _moveKey[jaName];
  }

  // 「相手の 」接頭の言語別テンプレ({n}=訳した名前)
  var OPP = {
    ja: '相手の {n}', en: 'the opposing {n}', fr: '{n} adverse', de: 'das gegnerische {n}',
    es: 'el {n} rival', it: 'il {n} avversario', ko: '상대의 {n}',
    'zh-Hans': '对手的{n}', 'zh-Hant': '對手的{n}',
  };
  function I18N() { return global.I18N; }
  function tPokeToken(raw, lang) {
    var opp = false, n = raw;
    if (n.indexOf('相手の ') === 0) { opp = true; n = n.slice(4); }
    var tr = (I18N() && I18N().pokemon) ? I18N().pokemon(n) : n;
    if (!opp) return tr;
    var t = OPP[lang] || OPP.en;
    return t.replace('{n}', tr);
  }
  function tSlot(raw, kind, lang) {
    if (raw == null) return '';
    if (kind === 'num' || kind === 'raw') return raw;
    if (kind === 'poke') return tPokeToken(raw, lang);
    if (kind === 'move') return (I18N() && I18N().move) ? I18N().move(moveKey(raw) || raw, raw) : raw;
    if (kind === 'ability') return (I18N() && I18N().ability) ? I18N().ability(raw) : raw;
    if (kind === 'item') return (I18N() && I18N().item) ? I18N().item(raw) : raw;
    return raw;
  }

  // 状態語の翻訳(I18N.t 共有語彙 status_* があれば使う・無ければ素通し)
  function tStatus(ja, lang) {
    var map = { 'もうどく': 'badly_poison', 'どく': 'poison', 'まひ': 'paralysis', 'やけど': 'burn', 'こおり': 'freeze', 'ねむり': 'sleep', 'ねむけ': 'drowsy', 'こんらん': 'confusion' };
    var I = I18N(); if (I && I.t && map[ja]) { var v = I.t('common.status_' + map[ja], ja); if (v && v !== ja) return v; }
    return ja;
  }

  // パターン(順に試す)。slots: {テンプレ名: {g:捕捉番号, kind:'poke'|'move'|'ability'|'item'|'num'|'raw'}}
  var P = [
    // 攻撃+ダメージ(残HPあり・一撃必殺フラグ任意)
    {
      re: /^((?:相手の )?\S+) の (\S+)！ ((?:相手の )?\S+) に (\d+) ダメージ！(\(一撃必殺！\))? \(残HP (\d+)(?:\/(\d+))?\)$/,
      tpl: { en: '{atk} used {move}! {df} took {dmg} damage!{ohko} (HP {hp}{max})' },
      slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' }, df: { g: 3, kind: 'poke' }, dmg: { g: 4, kind: 'num' }, ohko: { g: 5, kind: 'raw' }, hp: { g: 6, kind: 'num' }, max: { g: 7, kind: 'raw' } },
      post: { ohko: function (v) { return v ? ' (OHKO!)' : ''; }, max: function (v) { return v ? '/' + v : ''; } },
    },
    // 技を出すだけ(ダメージ別行)
    { re: /^((?:相手の )?\S+) の (\S+)！$/, tpl: { en: '{atk} used {move}!' }, slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' } } },
    // 外れた / 失敗 / 守った
    { re: /^(\S+) は外れた！$/, tpl: { en: '{move} missed!' }, slots: { move: { g: 1, kind: 'move' } } },
    { re: /^((?:相手の )?\S+) の (\S+)！ しかし うまく きまらなかった！$/, tpl: { en: '{atk} used {move}! But it failed!' }, slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' } } },
    // ひんし
    { re: /^((?:相手の )?\S+) は ひんしになった！$/, tpl: { en: '{p} fainted!' }, slots: { p: { g: 1, kind: 'poke' } } },
    // こうか・急所(完全一致)
    { re: /^こうかは ばつぐんだ！$/, tpl: { en: "It's super effective!" }, slots: {} },
    { re: /^こうかは いまひとつのようだ…$/, tpl: { en: "It's not very effective…" }, slots: {} },
    { re: /^きゅうしょに あたった！$/, tpl: { en: 'A critical hit!' }, slots: {} },
    { re: /^こうかが ないようだ…$/, tpl: { en: "It doesn't affect the target…" }, slots: {} },
    // 状態異常になった
    { re: /^((?:相手の )?\S+) は (\S+) 状態になった！$/, tpl: { en: '{p} was {st}!' }, slots: { p: { g: 1, kind: 'poke' }, st: { g: 2, kind: 'status' } } },
    { re: /^((?:相手の )?\S+) は こんらんした！$/, tpl: { en: '{p} became confused!' }, slots: { p: { g: 1, kind: 'poke' } } },
    // 動けない系
    { re: /^((?:相手の )?\S+) は からだが しびれて うごけない！$/, tpl: { en: '{p} is paralyzed and can’t move!' }, slots: { p: { g: 1, kind: 'poke' } } },
    { re: /^((?:相手の )?\S+) は こおっていて うごけない！$/, tpl: { en: '{p} is frozen solid!' }, slots: { p: { g: 1, kind: 'poke' } } },
    { re: /^((?:相手の )?\S+) は ねむっている！$/, tpl: { en: '{p} is fast asleep!' }, slots: { p: { g: 1, kind: 'poke' } } },
    { re: /^((?:相手の )?\S+) は メロメロで 技が だせなかった！$/, tpl: { en: '{p} is immobilized by love!' }, slots: { p: { g: 1, kind: 'poke' } } },
    // スリップダメージ(やけど/どく/もうどく)
    { re: /^((?:相手の )?\S+) は (やけど|どく|もうどく)で (\d+) ダメージ！ \(残HP (\d+)\)$/, tpl: { en: '{p} is hurt by {st}! ({n} dmg) (HP {hp})' }, slots: { p: { g: 1, kind: 'poke' }, st: { g: 2, kind: 'status' }, n: { g: 3, kind: 'num' }, hp: { g: 4, kind: 'num' } } },
    // 死に出し(交代)
    { re: /^たおれた ((?:相手の )?\S+) の代わりに ((?:相手の )?\S+) が 場に出た！$/, tpl: { en: '{out} fainted, so {in} was sent out!' }, slots: { out: { g: 1, kind: 'poke' }, 'in': { g: 2, kind: 'poke' } } },
  ];

  function translateLogLine(msg, lang) {
    lang = lang || (I18N() && I18N().lang) || 'ja';
    if (lang === 'ja' || !I18N() || msg == null) return msg;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], m = msg.match(p.re);
      if (!m) continue;
      var tpl = p.tpl[lang];
      if (!tpl) return msg;   // その言語の訳が未登録=ja(原文)フォールバック(英語混在を避ける)
      return tpl.replace(/\{(\w+)\}/g, function (_, name) {
        var s = p.slots[name]; if (!s) return '';
        var raw = (s.kind === 'status') ? tStatus(m[s.g], lang) : tSlot(m[s.g], s.kind, lang);
        if (p.post && p.post[name]) return p.post[name](m[s.g]);
        return raw;
      });
    }
    return msg; // 未対応=ja フォールバック(壊れない)
  }

  global.translateLogLine = translateLogLine;
  global.BATTLE_LOG_PATTERNS = P; // テスト・拡張用
})(typeof window !== 'undefined' ? window : globalThis);
