/* バトルログ多言語化(案X=表示時翻訳・演出は触らない)。
 * real_battle.html / real_battle_simulator.html の両方が読み込む共有モジュール。
 * - エンティティ(ポケ/技/特性/道具)は **ポケモンDBと共通の I18N(SSOT)** から訳す。
 * - 固定句は TPL(パターンid→言語別テンプレ)。パターンの正規表現は PATTERNS。
 * - 未登録言語/未対応パターンは ja(原文)フォールバック=壊れない・英語混在なし。演出は呼び元が ja msg を使うので無影響。
 * 依存: window.I18N(runtime.js)・WAZA_MAP(pokechan_data.js)。両方ロード後に使う。
 * ★段階導入: 高頻度パターン~16。残りパターン・翻訳は順次 TPL/PATTERNS に追加(並列WF)。
 */
(function (global) {
  'use strict';

  // 技名(ja)→ローマ字キー(I18N.move はキー要求)。初回アクセスで構築。WAZA_MAP は const(非window)→bare参照。
  var _moveKey = null;
  function moveKey(jaName) {
    if (!_moveKey) {
      _moveKey = {};
      var W = (typeof WAZA_MAP !== 'undefined') ? WAZA_MAP : (global.WAZA_MAP || null);
      if (W) for (var k in W) { if (W[k] && W[k].name) _moveKey[W[k].name] = W[k].key || k; }
    }
    return _moveKey[jaName];
  }
  function I18N() { return global.I18N; }

  // 「相手の 」接頭の言語別テンプレ({n}=訳した名前)
  var OPP = {
    ja: '相手の {n}', en: 'the opposing {n}', fr: '{n} adverse', de: 'das gegnerische {n}',
    es: 'el {n} rival', it: 'il {n} avversario', ko: '상대의 {n}',
    'zh-Hans': '对手的{n}', 'zh-Hant': '對手的{n}',
  };
  function tPokeToken(raw, lang) {
    var opp = false, n = raw;
    if (n.indexOf('相手の ') === 0) { opp = true; n = n.slice(4); }
    var tr = (I18N() && I18N().pokemon) ? I18N().pokemon(n) : n;
    if (!opp) return tr;
    return (OPP[lang] || OPP.en).replace('{n}', tr);
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
  // 状態語(共有語彙 common.status_* があれば使う)
  function tStatus(ja, lang) {
    var map = { 'もうどく': 'badly_poison', 'どく': 'poison', 'まひ': 'paralysis', 'やけど': 'burn', 'こおり': 'freeze', 'ねむり': 'sleep', 'ねむけ': 'drowsy', 'こんらん': 'confusion' };
    var I = I18N();
    if (I && I.t && map[ja]) { var v = I.t('common.status_' + map[ja], ja); if (v && v !== ja) return v; }
    return ja;
  }

  // ─── 翻訳テンプレ(id → 言語別)。en 完成・他言語は並列WFで順次。未登録は ja フォールバック。───
  var TPL = {
    attack_dmg: { "en": "{atk} used {move}! {df} took {dmg} damage!{ohko} (HP {hp}{max})", "fr": "{atk} utilise {move} ! {df} perd {dmg} PV !{ohko} (PV {hp}{max})", "de": "{atk} setzt {move} ein! {df} erleidet {dmg} Schaden!{ohko} (KP {hp}{max})", "es": "¡{atk} usó {move}! ¡{df} recibió {dmg} de daño!{ohko} (PS {hp}{max})", "it": "{atk} usa {move}! {df} subisce {dmg} danni!{ohko} (PS {hp}{max})", "ko": "{atk}의 {move}! {df}에게 {dmg}의 데미지!{ohko} (HP {hp}{max})", "zh-Hans": "{atk}使用了{move}！{df}受到了{dmg}点伤害！{ohko}（HP {hp}{max}）", "zh-Hant": "{atk}使出了{move}！{df}受到了{dmg}點傷害！{ohko}（HP {hp}{max}）" },
    used_move: { "en": "{atk} used {move}!", "fr": "{atk} utilise {move} !", "de": "{atk} setzt {move} ein!", "es": "¡{atk} usó {move}!", "it": "{atk} usa {move}!", "ko": "{atk}의 {move}!", "zh-Hans": "{atk}使用了{move}！", "zh-Hant": "{atk}使出了{move}！" },
    missed: { "en": "{move} missed!", "fr": "{move} échoue !", "de": "Die Attacke {move} ging daneben!", "es": "¡{move} falló!", "it": "{move} ha fallito!", "ko": "{move}이(가) 빗나갔다!", "zh-Hans": "{move}没有命中！", "zh-Hant": "{move}沒有命中！" },
    failed: { "en": "{atk} used {move}! But it failed!", "fr": "{atk} utilise {move} ! Mais cela échoue !", "de": "{atk} setzt {move} ein! Aber es ist fehlgeschlagen!", "es": "¡{atk} usó {move}! ¡Pero ha fallado!", "it": "{atk} usa {move}! Ma la mossa fallisce!", "ko": "{atk}의 {move}! 하지만 실패했다!", "zh-Hans": "{atk}使用了{move}！但是失败了！", "zh-Hant": "{atk}使出了{move}！但是失敗了！" },
    faint: { "en": "{p} fainted!", "fr": "{p} est K.O. !", "de": "{p} wurde besiegt!", "es": "¡{p} se debilitó!", "it": "{p} è esausto!", "ko": "{p}은(는) 쓰러졌다!", "zh-Hans": "{p}倒下了！", "zh-Hant": "{p}倒下了！" },
    super_eff: { "en": "It's super effective!", "fr": "C'est super efficace !", "de": "Das ist sehr effektiv!", "es": "¡Es supereficaz!", "it": "È superefficace!", "ko": "효과가 굉장했다!", "zh-Hans": "效果拔群！", "zh-Hant": "效果絕佳！" },
    not_very: { "en": "It's not very effective…", "fr": "Ce n'est pas très efficace…", "de": "Das ist nicht sehr effektiv…", "es": "No es muy eficaz…", "it": "Non è molto efficace…", "ko": "효과가 별로인 듯하다…", "zh-Hans": "效果不太好……", "zh-Hant": "效果不太好……" },
    crit: { "en": "A critical hit!", "fr": "Coup critique !", "de": "Ein Volltreffer!", "es": "¡Un golpe crítico!", "it": "Brutto colpo!", "ko": "급소에 맞았다!", "zh-Hans": "命中要害！", "zh-Hant": "擊中了要害！" },
    no_effect: { "en": "It doesn't affect the target…", "fr": "Ça n'affecte pas la cible…", "de": "Es hat keine Wirkung auf das Ziel…", "es": "No afecta…", "it": "Non ha effetto sul bersaglio…", "ko": "효과가 없는 듯하다…", "zh-Hans": "没有效果……", "zh-Hant": "對對手沒有效果……" },
    status_became: { "en": "{p} was afflicted with {st}!", "fr": "{p} subit l'effet {st} !", "de": "{p} wurde mit {st} belegt!", "es": "¡{p} sufre {st}!", "it": "{p} viene colpito da {st}!", "ko": "{p}은(는) {st} 상태가 되었다!", "zh-Hans": "{p}陷入了{st}状态！", "zh-Hant": "{p}陷入了{st}狀態！" },
    confused: { "en": "{p} became confused!", "fr": "{p} est confus !", "de": "{p} ist verwirrt!", "es": "¡{p} se ha confundido!", "it": "{p} è confuso!", "ko": "{p}은(는) 혼란에 빠졌다!", "zh-Hans": "{p}混乱了！", "zh-Hant": "{p}混亂了！" },
    cant_para: { "en": "{p} is paralyzed and can’t move!", "fr": "{p} est paralysé ! Il ne peut plus attaquer !", "de": "{p} ist paralysiert! Es kann sich nicht bewegen!", "es": "¡{p} está paralizado y no puede moverse!", "it": "{p} è paralizzato! Forse non può attaccare!", "ko": "{p}은(는) 몸이 저려서 움직일 수 없다!", "zh-Hans": "{p}因麻痹而无法行动！", "zh-Hant": "{p}因麻痺而無法行動！" },
    cant_freeze: { "en": "{p} is frozen solid!", "fr": "{p} est gelé !", "de": "{p} ist tiefgefroren!", "es": "¡{p} está completamente congelado!", "it": "{p} si è congelato!", "ko": "{p}은(는) 꽁꽁 얼어붙어 움직일 수 없다!", "zh-Hans": "{p}被冰冻住了！", "zh-Hant": "{p}被冰凍住了！" },
    asleep: { "en": "{p} is fast asleep!", "fr": "{p} dort profondément !", "de": "{p} schläft tief und fest!", "es": "¡{p} está profundamente dormido!", "it": "{p} si è addormentato!", "ko": "{p}은(는) 쿨쿨 잠들어 있다!", "zh-Hans": "{p}正在呼呼大睡！", "zh-Hant": "{p}睡得正香！" },
    cant_love: { "en": "{p} is immobilized by love!", "fr": "{p} est immobilisé par l'amour !", "de": "{p} ist vor lauter Liebe wie gelähmt!", "es": "¡{p} está inmovilizado por el enamoramiento!", "it": "{p} è immobilizzato dall'amore!", "ko": "{p}은(는) 헤롱헤롱해서 움직일 수 없다!", "zh-Hans": "{p}因着迷而无法行动！", "zh-Hant": "{p}著迷而無法行動！" },
    slip: { "en": "{p} is hurt by {st}! ({n} dmg) (HP {hp})", "fr": "{p} souffre de l'effet {st} ! ({n} dégâts) (PV {hp})", "de": "{p} wird durch {st} verletzt! ({n} Schaden) (KP {hp})", "es": "¡{p} se resiente de {st}! ({n} de daño) (PS {hp})", "it": "{p} è ferito da {st}! ({n} danni) (PS {hp})", "ko": "{p}은(는) {st}(으)로 데미지를 입었다! ({n} 데미지) (HP {hp})", "zh-Hans": "{p}受到了{st}的伤害！（{n}点伤害）（HP {hp}）", "zh-Hant": "{p}受到了{st}的傷害！（{n}點傷害）（HP {hp}）" },
    switch_in: { "en": "{out} fainted, so {in} was sent out!", "fr": "{out} est K.O., {in} entre en jeu !", "de": "{out} wurde besiegt, daher wurde {in} eingewechselt!", "es": "¡{out} se debilitó, así que sacó a {in}!", "it": "{out} è esausto, così è stato mandato in campo {in}!", "ko": "{out}이(가) 쓰러져서 {in}을(를) 내보냈다!", "zh-Hans": "{out}倒下了，于是派出了{in}！", "zh-Hant": "{out}倒下了，於是派出了{in}！" },
  };

  // ─── パターン(順に試す)。slots: テンプレ名→{g:捕捉番号, kind} ───
  var PATTERNS = [
    { id: 'attack_dmg', re: /^((?:相手の )?\S+) の (\S+)！ ((?:相手の )?\S+) に (\d+) ダメージ！(\(一撃必殺！\))? \(残HP (\d+)(?:\/(\d+))?\)$/,
      slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' }, df: { g: 3, kind: 'poke' }, dmg: { g: 4, kind: 'num' }, ohko: { g: 5, kind: 'raw' }, hp: { g: 6, kind: 'num' }, max: { g: 7, kind: 'raw' } },
      post: { ohko: function (v) { return v ? ' (OHKO!)' : ''; }, max: function (v) { return v ? '/' + v : ''; } } },
    { id: 'used_move', re: /^((?:相手の )?\S+) の (\S+)！$/, slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' } } },
    { id: 'missed', re: /^(\S+) は外れた！$/, slots: { move: { g: 1, kind: 'move' } } },
    { id: 'failed', re: /^((?:相手の )?\S+) の (\S+)！ しかし うまく きまらなかった！$/, slots: { atk: { g: 1, kind: 'poke' }, move: { g: 2, kind: 'move' } } },
    { id: 'faint', re: /^((?:相手の )?\S+) は ひんしになった！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'super_eff', re: /^こうかは ばつぐんだ！$/, slots: {} },
    { id: 'not_very', re: /^こうかは いまひとつのようだ…$/, slots: {} },
    { id: 'crit', re: /^きゅうしょに あたった！$/, slots: {} },
    { id: 'no_effect', re: /^こうかが ないようだ…$/, slots: {} },
    { id: 'status_became', re: /^((?:相手の )?\S+) は (\S+) 状態になった！$/, slots: { p: { g: 1, kind: 'poke' }, st: { g: 2, kind: 'status' } } },
    { id: 'confused', re: /^((?:相手の )?\S+) は こんらんした！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'cant_para', re: /^((?:相手の )?\S+) は からだが しびれて うごけない！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'cant_freeze', re: /^((?:相手の )?\S+) は こおっていて うごけない！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'asleep', re: /^((?:相手の )?\S+) は ねむっている！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'cant_love', re: /^((?:相手の )?\S+) は メロメロで 技が だせなかった！$/, slots: { p: { g: 1, kind: 'poke' } } },
    { id: 'slip', re: /^((?:相手の )?\S+) は (やけど|どく|もうどく)で (\d+) ダメージ！ \(残HP (\d+)\)$/, slots: { p: { g: 1, kind: 'poke' }, st: { g: 2, kind: 'status' }, n: { g: 3, kind: 'num' }, hp: { g: 4, kind: 'num' } } },
    { id: 'switch_in', re: /^たおれた ((?:相手の )?\S+) の代わりに ((?:相手の )?\S+) が 場に出た！$/, slots: { out: { g: 1, kind: 'poke' }, 'in': { g: 2, kind: 'poke' } } },
  ];

  function translateLogLine(msg, lang) {
    lang = lang || (I18N() && I18N().lang) || 'ja';
    if (lang === 'ja' || !I18N() || msg == null) return msg;
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i], m = msg.match(p.re);
      if (!m) continue;
      var tpl = TPL[p.id] && TPL[p.id][lang];
      if (!tpl) return msg;   // その言語の訳が未登録=ja(原文)フォールバック
      return tpl.replace(/\{(\w+)\}/g, function (_, name) {
        var s = p.slots[name]; if (!s) return '';
        if (p.post && p.post[name]) return p.post[name](m[s.g]);
        return (s.kind === 'status') ? tStatus(m[s.g], lang) : tSlot(m[s.g], s.kind, lang);
      });
    }
    return msg;
  }

  global.translateLogLine = translateLogLine;
  global.BATTLE_LOG_TPL = TPL;
  global.BATTLE_LOG_PATTERNS = PATTERNS;
})(typeof window !== 'undefined' ? window : globalThis);
