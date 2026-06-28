/* 叩き台: effects(SSOT) → ヤックン音の一文を「生成」するレンダラ試作。
 * 生成文を description_legacy(音の見本)/description と並べて検証。未対応kindは(未対応)で穴を可視化。
 * 実行: node tools/_waza_compose.js  → review/waza_compose.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { condStrNew } = require('./_cond_render.js');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

// ✓声ルール(台帳): 0.5→半分 / 1→全部 / それ以外→1/N スラッシュ表記(8分の1化しない)
const fracT = f => {
  if (f == null || isNaN(f)) return '';
  if (Math.abs(f - 1) < 0.001) return '全部';
  if (Math.abs(f - 0.5) < 0.001) return '半分';
  const r = Math.round(1 / f);
  if (Math.abs(1 / f - r) < 0.04) return `1/${r}`;
  // 真分数(2/3・3/4 等)は分数で書く=生の小数%露出(66.7%)を防ぐ
  for (let d = 2; d <= 16; d++) { const n = Math.round(f * d); if (n > 0 && n < d && Math.abs(f - n / d) < 0.005) return `${n}/${d}`; }
  return (+(f * 100).toFixed(1)) + '%';
};
const multT = mu => mu >= 1 ? `${mu}倍になる` : (Math.abs(mu - 0.5) < 0.001 ? '半分になる' : `${fracT(mu)}になる`);
const durT = d => Array.isArray(d) ? `${d[0]}〜${d[1]}ターン` : (typeof d === 'number' ? `${d}ターン` : ({ until_user_leaves: '自分が場を離れるまで', until_removed: '消えるまで' }[d] || d));
const TGT = { self: '自分', opponent: '相手', team: '自分と味方', all: '場の全員', ally: '味方', all_opponents: '相手全体', all_but_self: '自分以外', party: '手持ち全員', incoming: '次に出る味方' };
const TGT2 = { self: '自分の', opponent: '相手の', all_opponents: '相手全員の', ally: '味方の', team: '自分と味方全員の', all: '場の全員の', all_but_self: '自分いがいの全員の', party: '手持ちの', incoming: '次に出る味方の' };
// 能力名: こうげき系はlegacy同様ひらがな / 命中率・回避率はlegacyが漢字(ひらがな0件)→漢字。
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: '命中率', evasion: '回避率', all: 'すべての能力' };
const statList = e => (Array.isArray(e.stats) ? e.stats : [e.stat]).map(s => STAT[s] || s);
const joinStats = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a.join('と') : a.join('・');
const immT = arr => (arr || []).map(x => x.value || (x.values || []).join('・')).join('・');
// condStrNew は「〜の時/〜の場合」を返す。文頭につなぐ。
const condT = c => condStrNew(c).replace(/\s*⚠️要調査/g, '').replace(/の時$/, 'のとき').replace(/の場合は除く\)/, 'はのぞく)').replace(/『/g, '「').replace(/』/g, '」'); // 囲みは「」に統一(共有_cond_renderは触らずcompose側で吸収)。⚠要調査=翻訳済(リスト未確定)の印→除去して条件は出す

// ★現シーズンの強化システム在否(2026-06-15)。★2026-06-17 阿部さん変更: 未解禁システムは「非表示」でなく「（カッコ書き）」で残す。
// 来たら該当を true にするだけで、関連する一文(ダイウォール除外・ダイマックス技/Zワザ被弾軽減 等)が全技で「カッコ無しの通常文」に切り替わる(書き直し0)。
// ※メガシンカは現状解禁中=true。※第N世代/SV等の他作品トリビアはこれとは別カテゴリ(ext/drop方針)。詳細=review/rules.html「★未実装システム…」。
const SYSTEMS_IN_GAME = { mega: true, dynamax: false, tera: false, zmove: false };
const SYSTEM_OF = { 'ダイマックス': 'dynamax', 'キョダイマックス': 'dynamax', 'ダイウォール': 'dynamax', 'ダイマックス技': 'dynamax', 'テラスタル': 'tera', 'テラスタル技': 'tera', 'Zワザ': 'zmove', 'Z技': 'zmove', 'Zワザ攻撃技': 'zmove' };
const systemInGame = label => { const s = SYSTEM_OF[label]; return s ? !!SYSTEMS_IN_GAME[s] : true; }; // 未登録(通常技)は出してよい=true
const gateList = arr => (arr || []).filter(systemInGame); // 解禁済の項目だけ(=通常文に出す分)
const gatedItems = arr => (arr || []).filter(x => !systemInGame(x)); // 未解禁の項目(=カッコ書きで残す分)
// ★2026-06-17: 未解禁システムもカッコ書きで残すようになったので「丸ごとスキップ」はしない(全effectを描画)。
const isFullyGated = e => false;

const amountT = a => a === '自分の残りHP分' ? '自分のいまのこっているHPと同じだけ' : a;
// ※ランク増減は±N表記に統一(能力=こうげき+1 / 急所=急所+1)。旧・和語数詞ヘルパー(kazuT)は2026-06-07に廃止。
// 威力可変ヘルパー(英語formula/basisは出さない=機械漏れ防止。未知形はnull=穴)
const ratioFrac = r => `1/${Math.round(1 / r)}`; // 0.2→1/5(fracTは0.5を半分にするので比率専用)
const fmlT = e => { // 既知formulaのみ和文化。未知はnull(生英語式を出さない)
  const f = (e.formula || '').replace(/\s+/g, '');
  if (/^(floor\()?150\*currentHP\/maxHP\)?$/.test(f)) return '自分のHPが少ないほど威力が下がる(威力は 150×今のHP÷最大HP・端数切り捨て)';
  if (f === 'floor(25*target_speed/user_speed)+1') return `相手よりすばやさが低いほど威力が高くなる(威力は 25×相手のすばやさ÷自分のすばやさ+1・端数切り捨て・最大${e.max_power})`;
  if (f === '100*target_current_HP/target_max_HP') return '相手の残りHPが多いほど威力が高くなる(威力は 100×相手の今のHP÷相手の最大HP)';
  return null;
};
const wtKgT = arr => arr.map(t => t.min_kg != null ? `${t.min_kg}kg以上は${t.power}` : `${t.max_kg}kg未満は${t.power}`).join('・');
const wRatioT = arr => arr.map(t => { const r = t.target_weight_at_most_fraction_of_user != null ? t.target_weight_at_most_fraction_of_user : t.max_ratio; return (r == null || t.otherwise) ? `それ以外なら${t.power}` : `${ratioFrac(r)}以下なら${t.power}`; }).join('・');
const sRatioT = arr => arr.map(t => t.ratio_at_or_above != null ? `${t.ratio_at_or_above}倍以上は${t.power}` : `${t.ratio_below}倍未満は${t.power}`).join('・');
// kind → 文の部品(子ども口調)。conditionは付けない(compose側でグループ束ね)。未対応は null。
function clause(e, m) {
  const k = e.kind, t = TGT[e.target] || e.target;
  switch (k) {
    case '状態付与': {
      // ★2026-06-29 value欠落のundefined防止: detail/noteで意味を出す(サイコシフト等の状態コピー系)
      if (!e.value) {
        if (e.detail === 'copy_user_status') return `自分がいまかかっている状態異常を、そのまま相手にうつす(自分が状態異常でないときや、相手がすでに別の状態異常・効かないタイプのときは失敗する)`;
        return null; // 不明はundefinedを出さず穴
      }
      if (e.value === 'バインド') {
        let s = `相手をバインド状態にして、${durT(e.duration)}の間、毎ターン終わりに、最大HPの${fracT(e.turn_end_damage)}だけダメージを与える`;
        if (e.prevents_switch) s += `。その間、${immT(e.immune)}タイプでない相手は、逃げたり交代したりできない`;
        return s;
      }
      // ★2026-06-17 阿部さん: 攻撃技で prob:100 は「必ず」を明示(ばくれつパンチ等が確率制と誤読される問題対策)。
      //   変化技の prob:100 は既に確定なので省略(legacy慣例)。
      const pp = (e.prob != null && e.prob < 100) ? `${e.prob}%の確率で`
        : (e.prob === 100 && m && m.power > 0 ? '必ず' : '');
      if (e.value === 'ひるみ') return `${pp}相手をひるませる`; // ひるみは動作=「ひるませる」(『ひるみ』状態にする は不自然・kind:ひるみ と統一)
      // ★2026-06-15: duration_turns(範囲string "1-4" 等)も対応(あやしいひかり等で取りこぼし)
      let dd = '';
      if (e.duration) { const dt = durT(e.duration); dd = /あいだ$|間$/.test(dt) ? `${dt}、` : `${dt}の間、`; } // 「あいだ」終わりは「の間」重複を避ける(うちおとす)
      else if (typeof e.duration_turns === 'string') dd = `${e.duration_turns.replace('-', '〜')}ターンの間、`;
      else if (Array.isArray(e.duration_turns)) dd = `${e.duration_turns[0]}〜${e.duration_turns[1]}ターンの間、`;
      else if (e.duration_turns && typeof e.duration_turns === 'object') dd = `${e.duration_turns.min}〜${e.duration_turns.max}ターンの間、`; // {min,max}形(フラフラダンス)
      // ★2026-06-15: value 配列(トライアタックの「まひ・やけど・こおり」)はランダム1つを明示
      if (Array.isArray(e.value)) {
        return `${pp}${dd}${t}を「${e.value.join('」「')}」のうちランダムで1つの状態にする`;
      }
      // ★2026-06-15: forced=true で value='ねむり' duration=2 (ねむる): 3ターン目に目覚める
      if (e.forced === true && e.value === 'ねむり' && e.duration === 2) {
        return `2ターンの間、自分を「ねむり」状態にして、3ターン目に目を覚ます`;
      }
      // ★2026-06-15: delayed (あくび): 次のターン終わりに状態異常+「相手が交代すると効果は消える」
      if (e.phase === 'delayed' && e.delay_turns === 1 && e.trigger === 'turn_end') {
        const rem = e.removed_if ? `(相手が交代すると効果は消える)` : '';
        return `次のターン終わりに${t}を「${e.value}」状態にする${rem}`;
      }
      // ★暴れ終わったあとの混乱(あばれる/げきりん等): trigger=rampage_end(2026-06-17)
      if (e.trigger === 'rampage_end') return `暴れ終わったあと、${dd}${t === '自分' ? '自分が' : `${t}が`}「${e.value}」状態になる`;
      // ★状態の中身を喋る(voiced≠complete 補完・2026-06-17): 状態名だけでは意味が戻らない技に、データの該当フィールドを足す。
      let base = `${pp}${dd}${t}を「${e.value}」状態にする`; // 囲みは「」(2026-06-07 阿部さん・ヤックン『』と差別化)
      const det = [];
      if (e.crit_stages) det.push(`急所ランクが${e.crit_stages > 0 ? '+' : ''}${e.crit_stages}ぶん上がって、技が急所に当たりやすくなる`); // きあいだめ
      if (e.stat && e.multiplier) det.push(`${STAT[e.stat] || e.stat}が${e.multiplier}倍になる`); // おいかぜ
      if (e.tick_effect && e.tick_effect.kind === 'stat' && e.tick_effect.phase === 'turn_end') { // みずあめボム
        const ts = STAT[e.tick_effect.stat] || e.tick_effect.stat, sg = e.tick_effect.stages > 0 ? `+${e.tick_effect.stages}` : `${e.tick_effect.stages}`;
        det.push(`その間、毎ターン終わりに${t}の${ts}${sg}`);
      }
      if (e.substitute_hp && e.substitute_hp.fraction) det.push(`「みがわり」のHPは最大HPの${fracT(e.substitute_hp.fraction)}になる`); // しっぽきり
      if (Array.isArray(e.grants_immunity_to)) { // でんじふゆう
        const parts = e.grants_immunity_to.map(g => g.type === 'move_type' ? `「${(g.values || []).join('」「')}」タイプの技` : `「${(g.values || []).join('」「')}」`);
        if (parts.length) det.push(`地面にいない扱いになり、${parts.join('・')}の効果を受けなくなる`); // でんじふゆう grants_immunity_to 全列挙(2026-06-17 阿部さん「など」削除)
      }
      if (e.prevents && e.prevents.healing_moves) { // サイコノイズ: 回復技を全列挙(2026-06-17 阿部さん)
        det.push(`その間、回復系の技(「${e.prevents.healing_moves.join('」「')}」)が使えなくなる`);
        if (e.prevents.hp_recovery_from) det.push(`特性・道具・場の効果によるHPの回復も起きなくなる`);
      } else if (e.prevents && e.prevents.hp_recovery_from) det.push(`その間、特性・道具・場の効果によるHPの回復も起きなくなる`);
      if (e.value === 'ちいさくなる' && Array.isArray(e.affected_moves)) det.push(`「${e.affected_moves.join('」「')}」は、この状態のとき必ず当たり、受けるダメージが2倍になってしまう`); // ちいさくなる affected_moves 全列挙(2026-06-17 阿部さん)
      if (e.value === 'もうどく' && e.note) det.push(`「もうどく」は、毎ターン終わりに受けるダメージが1/16→2/16→3/16…と増えていく`);
      if (e.value === 'うちおとす') det.push(`地面に落とされて、特性「ふゆう」やひこうタイプでも「じめん」タイプの技が当たるようになる`);
      return det.length ? `${base}。${det.join('。')}` : base;
    }
    case '拘束':
      return `${immT(e.immune)}タイプでない相手を、${durT(e.duration)}の間、逃げたり交代したりできないようにする`;
    case 'まもり貫通': {
      // ★bypasses形(ゴーストダイブ/なみだめ): 相手の守り技リストの効果を受けない。not_bypassed=除外。
      if (Array.isArray(e.bypasses)) {
        const inG = gateList(e.not_bypassed), gd = gatedItems(e.not_bypassed); // 解禁分は通常文・未解禁(ダイウォール)はカッコ書き
        let ex = inG.length ? `(「${inG.join('」「')}」は除く)` : '';
        if (gd.length) ex += `（${gd.join('・')}は除く）`;
        return `相手の「${e.bypasses.join('」「')}」の効果を受けない${ex}`;
      }
      // フェイント形: まもる等を貫通して当たる(一部除く)。まもり解除kindが本文を言うので、未解禁のみのときは除外をカッコで添える
      if (Array.isArray(e.pierces_without_removing)) {
        const inG = gateList(e.pierces_without_removing), gd = gatedItems(e.pierces_without_removing);
        // ★2026-06-18 阿部さん再修正: フェイントの「pierces_without_removing=ダイウォール」は「貫通して当たるが解除はできない」が正しい。
        //   「防がれる」(=攻撃が通らない)は逆の意味=誤訳。「解除はできないが攻撃は通る」と書く。
        if (inG.length) return `相手が「まもる」などで守っていても、それを無視して当たる(「${inG.join('」「')}」は除く)${gd.length ? `（${gd.join('・')}は解除できないが、攻撃は通る）` : ''}`;
        return `（${gd.join('・')}は解除できないが、攻撃は通る）`;
      }
      // ニードルガード形(守り側): ダイマックス技/Zワザで攻撃されてもダメージを軽くする
      if (Array.isArray(e.values) && e.user_takes_fraction != null) {
        const inG = gateList(e.values);
        if (inG.length) return `「${inG.join('」「')}」で攻撃されても、受けるダメージを最大HPの${fracT(e.user_takes_fraction)}までにおさえる`;
        return `（ダイマックス技やZワザの攻撃は、防いでも最大HPの${fracT(e.user_takes_fraction)}のダメージを受ける）`; // 未解禁=カッコ書き(まもる/みきり/ニードルガード)
      }
      return `相手のまもる・みきりなどを無視して攻撃する`; // ★2026-06-28 最小形(パワフルエッジ等)
    }
    case '反動':
      return `相手に与えたダメージの${fracT(e.fraction)}を、自分も受ける`;
    case '威力倍率':
      return `威力が${multT(e.multiplier)}`;
    case '自分瀕死':
      return `技を使ったあと、自分はひんしになる`; // いやしのねがい/みかづきのいのり/さいきのいのり等
    case '回復':
      // ★2026-06-15: amount構造化対応(ちからをすいとる等)。fractionは従来どおり。
      if (e.amount && typeof e.amount === 'object') {
        const STAT = { attack:'こうげき', defense:'ぼうぎょ', special_attack:'とくこう', special_defense:'とくぼう', speed:'すばやさ' };
        if (e.amount.type === 'target_stat') return `相手の「${STAT[e.amount.stat] || e.amount.stat}」の実数値と同じだけ、${t}のHPを回復する`;
      }
      if (e.fraction == null) return null; // 穴=出さない(機械漏れ防止)
      // ★遅延回復(ねがいごと): 次のターン終わりに、その場所のポケモンを回復(2026-06-17)
      if (e.phase === 'delayed' && e.trigger === 'turn_end') {
        const rep = e.heals_replacement ? `(自分が交代しても、同じ場所に出たポケモンが回復する)` : '';
        return `次のターンの終わりに、${t}のHPを最大HPの${fracT(e.fraction)}だけ回復する${rep}`;
      }
      // ★2026-06-15/06-17: 毎ターン回復(ねをはる/アクアリング/フィールド回復)。phase=lasting&trigger=turn_end か phase=turn_end 単独。即時回復の誤読を防ぐ。
      if ((e.phase === 'lasting' && e.trigger === 'turn_end') || e.phase === 'turn_end') {
        // ★grounded(フィールド回復=グラスフィールド): 被弾側基準で「地面にいるポケモンの」と書く(condT前置の重複を解消)
        const grnd = e.condition && (e.condition.type === 'grounded' || e.condition.type === 'target_grounded');
        const ex = grnd && (e.condition.excludes_types || e.condition.excludes_abilities) ? `(ひこうタイプや特性「ふゆう」などはのぞく)` : '';
        if (grnd) return `毎ターン終わりに、地面にいるポケモンのHPを最大HPの${fracT(e.fraction)}だけ回復する${ex}`;
        return `毎ターン終わりに、${t}のHPを最大HPの${fracT(e.fraction)}だけ回復する`;
      }
      // ★2026-06-15: fraction=1=全部のときは「だけ」を付けない(「全部だけ回復する」が不自然 - のみこむ)
      const fr = fracT(e.fraction);
      // ★2026-06-18: incoming(次に出る味方)+全回復 = いやしのねがい/みかづきのいのり/さいきのいのり → 「ただしPPは回復しない」明示
      const ppNote = (e.target === 'incoming' && fr === '全部') ? `(ただしPPは回復しない)` : ``;
      return ((fr === '全部') ? `${t}のHPを全部回復する` : `${t}のHPを、最大HPの${fr}だけ回復する`) + ppNote;
    case 'HPが減る':
      return `自分のHPが最大HPの${fracT(e.fraction)}減る` + (e.always_pays_even_if_blocked ? `(相手が「まもる」などで防いでも、自分のHPは減る)` : ``); // てっていこうせん
    case '固定ダメージ': {
      let s = `相手に、${amountT(e.amount)}のダメージを与える(タイプ相性は受けない)`;
      if (e.minimum === 1) s += `(相手の残りHPが1のときは1ダメージになる)`; // いかりのまえば
      if (e.champions_amount) s += `(チャンピオンズでは${e.champions_amount}ダメージ)`; // ちきゅうなげ
      return s;
    }
    case '継続削り':
      return `毎ターン、相手のHPを最大HPの${fracT(e.fraction)}だけ削る`;
    case '連続攻撃': {
      // ★hits_by は data の条件文字列をそのまま喋る(ふくろだたき=ひんし/状態異常を除く手持ちの数。一般化して落とさない)
      let base;
      if (e.hits_by) base = `${e.hits_by}だけ攻撃する`;
      else if (e.stop_on_miss) base = `外れるまで最大${e.max_hits}回つづけて攻撃する`;
      else if (e.hits) base = `${e.hits}回つづけて攻撃する`;
      else if (e.min_hits) base = `${e.min_hits}〜${e.max_hits}回つづけて攻撃する`;
      else return null;
      // ★当たるたびに威力が上がる技(トリプルアクセル=20→40→60)。power_per_hit を落とさない
      if (Array.isArray(e.power_per_hit)) base += `。当たるたびに威力が上がる(${e.power_per_hit.join('→')})`;
      // ★ダブルバトルの挙動(ドラゴンアロー=相手それぞれに1回ずつ)。doubles_note を落とさない
      if (e.doubles_note) base += `。${e.doubles_note}`;
      return base;
    }
    case '急所率上昇':
      // ★±N表記(2026-06-07 阿部さん上書き): 「急所+1」(「ランク」語は省く・短く=能力ランク±Nと揃える)。always_crit→「必ず急所に当たる」。
      if (e.always_crit) return `必ず急所に当たる`;
      // 味方の急所ランクを上げる継続バフ(ドラゴンエール等)は対象を明示。それ以外(技自体の急所率)は「急所+N」。
      // ★2026-06-18: phase=lasting なら「きゅうしょアップ状態にして、今後使う技が急所に当たりやすくなる」を補足
      if (e.target === 'ally' || e.target === 'team') {
        const cont = e.phase === 'lasting' ? `(「きゅうしょアップ」状態となり、今後使う技が急所に当たりやすくなる)` : ``;
        return `自分以外の味方の急所${e.stages > 0 ? '+' : ''}${e.stages}${cont}`;
      }
      return `急所${e.stages > 0 ? '+' : ''}${e.stages}`;
    case 'ひるみ':
      // ★忠実版: kind:ひるみ = N%の確率で相手をひるませる(状態付与:ひるみ と統一)。
      return `${(e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''}相手をひるませる`;
    case '必中':
      // ★忠実版(開通順#3・2026-06-07 阿部さんの耳で確定): 無条件必中は「相手の回避率や自分の命中率に関係なく」を明記する。
      // = 必中の意味そのもの(相手のかいひランク上昇=ちいさくなる/どろかけ等で自分の命中率が下がっていても無視して当たる)。simにも効く情報→落とさない。
      // 条件付き(相手が「ちいさくなる」使用時など)は条件をcomposeが前置→本体は「必ず命中する」。
      return e.condition ? `必ず命中する` : `相手の回避率や自分の命中率に関係なく、必ず命中する`;
    case '威力可変': {
      // ★忠実版: データの段階表/式をそのまま日本語で。英語formula/basisは出さない・未知形はnull(穴)。
      // ★2026-06-28 全国版の特殊basis(formula判定より前に処理=formulaは未知でnullになるため)
      const maxP = e.max_power || e.power_max;
      if (e.scales_with === 'なつき度' || e.basis === 'friendship') return `ポケモンがなついているほど威力が高くなる${maxP ? `(最大${maxP})` : ''}`;
      if (e.scales_with === 'target_remaining_HP_ratio' || e.based_on === 'target_hp_ratio') return `相手の残りHPが多いほど威力が高くなる${maxP ? `(最大${maxP})` : ''}`;
      if (e.basis === 'consecutive_hits') return `当てるたびに威力が2倍ずつ増えていく${maxP ? `(最大${maxP})` : ''}`;
      if (e.scales_with === 'consecutive_uses') return `毎ターン続けて使うほど威力が高くなっていく${maxP ? `(最大${maxP})` : ''}`;
      if (e.based_on === 'remaining_pp') return `この技の残りPPが少ないほど威力が高くなる`;
      if (e.basis === 'held_berry') return `持っている「きのみ」によって威力が変わる`;
      if (e.condition && e.condition.type === 'pledge_combo') return `ダブルバトルで他の「ちかい」技と合わせて使うと、威力が${maxP || 150}になり、追加の効果が出る`;
      if (e.basis === 'random' && Array.isArray(e.tiers)) return `威力はランダムで決まる(${e.tiers.map(t => `${t.prob}%で${t.power}`).join('・')})`;
      if (Array.isArray(e.power_table)) return `威力は${e.power_table.map(t => `${t.prob}%で${t.power}`).join('・')}になる`;
      if (e.relation === 'lower_hp_higher_power') return `自分の残りHPが少ないほど威力が高くなる(威力${e.power_min}〜${e.power_max})`;
      if (e.formula) return fmlT(e); // 既知のみ・未知null
      if (e.tiers && (e.tiers[0] || {}).max_kg != null) return `相手のおもさが重いほど威力が高くなる(${wtKgT(e.tiers)})`;
      if (e.weight_thresholds) return `相手のおもさが重いほど威力が高くなる(${wtKgT(e.weight_thresholds)})`;
      if (e.basis === 'weight_ratio_target_over_user' || (e.table && (e.table[0] || {}).max_ratio !== undefined)) return `自分のおもさが相手より重いほど威力が高くなる(相手のおもさが自分の${wRatioT(e.table)})`;
      if (e.basis === 'user_speed_over_target_speed') return `自分のすばやさが相手より高いほど威力が高くなる(自分のすばやさが相手の${sRatioT(e.table)})`;
      if (e.per_stage) return `自分の能力ランクが1段階上がっているごとに威力が${e.per_stage}上がる(基礎威力${e.base_power})`;
      if (e.based_on === 'stockpile_count' && e.power_table) return `たくわえた数で威力が変わる(${Object.entries(e.power_table).map(([k, v]) => `${k}つで${v}`).join('・')})`;
      if (e.multiplier) return `威力が${multT(e.multiplier)}`; // 条件付き倍率(やけっぱち等)。条件はcompose側が前置
      if (e.based_on === 'weather' && e.power_table) {
        const w = e.power_table; const lo = w.no_weather, hi = w.any_weather;
        if (lo != null && hi != null) return `天気があると威力が${lo}から${hi}に上がる`;
      }
      // ★2026-06-19 新技対応: ふんどのこぶし(コノヨザル)= 怒り蓄積式
      if (e.basis === 'rage_accumulator') {
        const per = e.per_hit_taken || 50;
        const reset = e.reset_at_turn_end ? '。ターンが終わると蓄積はリセットされる' : '';
        return `攻撃を受けるたびに威力が${per}ずつ上がっていく${reset}`;
      }
      return null; // needs_research 等は穴
    }
    case '能力ランク変化': {
      if (e.reset) return `場にいる全員の能力ランクの変化を、すべて元にもどす`; // くろいきり
      if (e.stat_by_condition) return e.stat_by_condition; // ★2026-06-28 いっちょうあがり(姿で上がる能力が変わる)
      if (!e.stat && !e.stats) return null;
      const sts = statList(e);
      const pre = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : '';
      const who = TGT2[e.target] || (t + 'の');
      // ★±N表記に統一(2026-06-07 阿部さん): 能力ランクの増減は「こうげき-1、とくこう-1」。✗「〜が1段階さがる」。
      // 各能力に符号つき数値を付ける(同stagesでも能力ごとに繰り返す)。to_maxのみ特例(数値でない)。
      if (e.to_max) return `${pre}${who}${joinStats(sts)}が最大まであがる`;
      const sg = e.stages > 0 ? `+${e.stages}` : `${e.stages}`; // 負はそのまま(-2 など)
      // ★stat_choice='random_one_of' (つぼをつく等): 全列挙でなくランダム1つを明示(2026-06-15)
      if (e.stat_choice === 'random_one_of') {
        return `${pre}${who}「${sts.join('」「')}」のうちランダムで1つが${sg}`;
      }
      // ★主要5能力(こうげき/ぼうぎょ/とくこう/とくぼう/すばやさ)が全部同時(げんしのちから等)は「すべての能力」とまとめる(2026-06-17 阿部さん・「ランダムで1つ?」誤読防止)
      const MAIN5 = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'];
      const rawStats = Array.isArray(e.stats) ? e.stats : (e.stat ? [e.stat] : []);
      const isAll5 = rawStats.length === 5 && MAIN5.every(s => rawStats.includes(s));
      let main = isAll5
        ? `${pre}${who}すべての能力(${sts.join('・')})が一気に${sg}`
        : `${pre}${who}${sts.map(s => `${s}${sg}`).join('、')}`;
      // ★攻撃技で自分の能力ランク「ダウン」は legacy が「攻撃後、」を明示=実機の Phase 9(攻撃後)に下がる(2026-06-17 阿部さん・リファレンス §3 確認済)。
      //    インファイト/りゅうせいぐん/ばかぢから等。アップ系(はがねのつばさ等)は legacy も「攻撃後」を省略するので前置しない。
      //    sim側も phaseApplyEffects 内で処理(real_battle_simulator.html L3390)=データのphase:on_useはsim実装で攻撃後扱い。
      //    例外: timing='after_damage'(バリアーラッシュ等)はデータで明示されているのでアップ系でも「攻撃したあと」を付ける。
      if (e.target === 'self' && m && m.power > 0 && !e.on_charge_turn && ((e.stages || 0) < 0 || e.timing === 'after_damage')) main = `攻撃したあと、${main}`;
      // ★2026-06-15: modifier (せいちょうの「にほんばれ」で2段階等)を訳す
      if (e.modifier && e.modifier.type === 'weather' && e.modifier.stages != null) {
        const mg = e.modifier.stages > 0 ? `+${e.modifier.stages}` : `${e.modifier.stages}`;
        main += `(天気が「${(e.modifier.values || []).join('」「')}」のときは${mg})`;
      }
      // ★ちからをすいとる: note「相手の能力を下げられない時は、回復だけする」を補足(共起=回復kindと一緒)
      if (e.note && /下げられない時は、回復だけする/.test(e.note)) main += `(相手の能力を下げられない時は、回復だけする)`;
      // ★2026-06-18: 特定状態時失敗(きりばらい=相手が「みがわり」のとき回避率低下のみ失敗)
      if (e.fails_if_target_state) main += `(相手が「${e.fails_if_target_state}」状態のときは、この効果だけ失敗する)`;
      // ★2026-06-18: シードの能力ランク変化は「道具持ち=地面にいなくても効く」(エレキシード等)
      if (e.airborne_too) main += `(この効果は、地面にいないポケモンでも発動する)`;
      return main;
    }
    case '2ターン目に攻撃': {
      // ★ためわざ(SOP開通#: 2ターン目に攻撃)。1ターン目ためて2ターン目に攻撃。
      //   バリアント: 半無敵(semi_invulnerable+vulnerable_to) / 天候で溜め省略(skip_charge_if_weather)。
      //   他効果(急所/状態付与/威力倍率/能力ランク/まもり貫通)は各kindのテンプレが喋る→ここはため挙動だけ。
      const VERB = { '空中': '空中へ飛び上がり', '地中': '地中に潜り', '水中': '水中に潜り', '消失': 'すがたを消し' };
      const loc = e.semi_invulnerable;
      // ★溜めターンに発動する能力上昇(on_charge_turn・エレクトロビーム)を「1ターン目は攻撃せず{上昇}、…」に織り込む。
      //   ※データは既に on_charge_turn:true を持つ=データ変更不要。composeは on_charge_turn の能力ランク変化を別出力しない(下のskip)。
      const chargeRank = ((m.battle_data || {}).effects || []).find(x => x.kind === '能力ランク変化' && x.on_charge_turn);
      const chargeStat = chargeRank ? clause(chargeRank, m) : '';
      let s;
      if (loc) {
        s = `1ターン目に${VERB[loc] || `${loc}に入り`}、2ターン目に攻撃する`;
        if (Array.isArray(e.vulnerable_to) && e.vulnerable_to.length)
          s += `。${loc}にいる間は「${e.vulnerable_to.join('」「')}」以外の技を受けない`;
        else
          s += `。すがたを消している間は、ほとんどの技を受けない`; // 消失でvulnerable_to無し(ゴーストダイブ)
      } else {
        s = `1ターン目は攻撃せず${chargeStat}、2ターン目に攻撃する`;
      }
      if (Array.isArray(e.skip_charge_if_weather) && e.skip_charge_if_weather.length)
        s += `。天気が「${e.skip_charge_if_weather.join('」「')}」のときは、ためずにすぐ攻撃できる`;
      return s;
    }
    default:
      return null; // 穴
    // ===== 2026-06-14 独立検証で炙った穴を開通(子ども口調・機械漏れ無し)。曖昧/複雑は null のまま残す。 =====
    case '状態異常回復': {
      // ★2026-06-15: target/value/values の組み合わせを正確に喋り分け(こうそくスピン重複対策・ねっとう等の取りこぼし対策)
      const WHO = { team:'味方みんな', self:'自分', party:'手持ち全員', incoming:'次に出る味方', all:'場の全員', all_but_self:'自分以外の全員', all_opponents:'相手全員', opponent:'相手', ally:'味方' };
      const who = WHO[e.target] || '自分';
      // values=技名配列(こうそくスピンのバインド系): 自分が受けている「うずしお」「...」の効果を解除する
      if (Array.isArray(e.values) && e.values.length) {
        const bindHead = e.value ? `「${e.value}」状態(` : '';
        const bindTail = e.value ? ')' : '';
        return `${who}が受けている${bindHead}「${e.values.join('」「')}」${bindTail}の効果を解除する`;
      }
      // value=array(複数の状態/効果名): 「でんじふゆう」「テレキネシス」を解除する
      if (Array.isArray(e.value)) return `${who}の「${e.value.join('」「')}」の効果を解除する`;
      // value=具体的な状態名(こおり/やけど/みがわり/やどりぎのタネ等): その状態だけ解除
      if (typeof e.value === 'string' && e.value !== 'all') {
        // ★こおりを自分で治す技は「こおっていても使える」が肝(ねっさのだいち・もえつきる)
        if (e.value === 'こおり' && e.target === 'self' && (e.usable_while_frozen || /こおっていても/.test(e.note || '')))
          return `こおっていてもこの技は使え、使うと自分の「こおり」がとける`;
        return `${who}の「${e.value}」状態を解除する`;
      }
      // value=undefined or "all": 全部
      return `${who}の状態異常をすべて治す`;
    }
    case '吸収':
      return `相手に与えたダメージの${fracT(e.fraction)}だけ、自分のHPを回復する` + (e.basis === 'damage_dealt' ? `` : ``);
    case '自分交代':
      // ★2026-06-15: 変化技(power無)で「攻撃したあと」と書かない(しっぽきり・さむいギャグの誤読対策)
      if (Array.isArray(e.pass) && e.pass.length) return `自分にかかっていた能力ランクの変化や一部の状態(「みがわり」「やどりぎのタネ」「きあいだめ」など)を、控えのポケモンに引きついで交代する(「ちょうはつ」「メロメロ」などは引きつがない)`; // 2026-06-18 バトンタッチ詳細
      // ★2026-06-17: pass_to_replacement (しっぽきり=みがわり状態を引き継ぐ)
      if (Array.isArray(e.pass_to_replacement) && e.pass_to_replacement.length) return `控えのポケモンと交代する(「${e.pass_to_replacement.join('」「')}」状態は次のポケモンに引き継がれる)`;
      return (m && m.power && m.power > 0) ? `攻撃したあと、控えのポケモンと交代する` : `使ったあと、控えのポケモンと交代する`;
    case 'みがわり貫通':
      return `相手の「みがわり」をすりぬけて当たる`;
    case '半無敵命中': {
      const M = { '水中': 'ダイビング', '地中': 'あなをほる', '空中': 'そらをとぶ・とびはねる・フリーフォール' };
      const states = e.hits_state || [];
      const moves = states.map(s => M[s] || s).join('」「');
      let s = `相手が「${moves}」で${states.join('・')}にいる時でも当てられる`;
      if (e.damage_multiplier && e.damage_multiplier !== 1) s += `。そのときダメージが${e.damage_multiplier}倍になる`;
      return s;
    }
    case '次のターン行動不能':
      return `使った次のターンは、動けなくなる`;
    case 'まもり': {
      // ★中身を発声(2026-06-17): 対象(team)・攻撃技のみ・先制技のみ・成功率1/3+リセット をデータから訳す。
      const who = e.target === 'team' ? '自分と味方' : '自分';
      let s;
      if (e.blocks_priority_only) s = `そのターン、相手の先制技から${who}をまもる(特性で先制になった技もふくむ)`; // 2026-06-18 ファストガード
      else if (e.blocks_status_moves === false) s = `そのターン、相手の攻撃技をふせぐ(変化技はふせげない)`;
      else s = `そのターン、相手の技をふせぐ`;
      s += (e.consecutive_success_multiplier != null)
        ? `。続けて使うたびに、成功する確率が${fracT(e.consecutive_success_multiplier)}になる(失敗するともとにもどる)`
        : `。続けて使うと失敗しやすくなる`;
      // ★ダイマックス技/Zワザは防ぎきれずダメージ(まもる/みきり=partial_bypass)。未解禁はカッコ書き(2026-06-17)。
      if (e.partial_bypass) {
        const pb = Array.isArray(e.partial_bypass) ? e.partial_bypass : [e.partial_bypass];
        const frac = pb[0] && pb[0].damage_fraction;
        if (frac != null) s += SYSTEMS_IN_GAME.dynamax ? `。ダイマックス技やZワザの攻撃は防げず、最大HPの${fracT(frac)}のダメージを受ける` : `（ダイマックス技やZワザの攻撃は、防いでも最大HPの${fracT(frac)}のダメージを受ける）`;
      }
      return s;
    }
    case 'こらえる':
      return `そのターン、ひんしになる攻撃を受けてもHPが1だけ残ってたえる。続けて使うと失敗しやすくなる`; // 2026-06-18 阿部さん指摘: 「ひんしになる攻撃時」が正しい
    case '範囲まもり':
      return `そのターン、複数を巻きこむ技から自分と味方をまもる`;
    case 'まもり解除': {
      const aff = Array.isArray(e.affected_moves) && e.affected_moves.length ? `「${e.affected_moves.join('」「')}」` : '「まもる」など';
      return `相手の${aff}の守りをやぶってから攻撃する`; // ★略さない: データのaffected_moves全列挙(2026-06-26・なみだめ/ちいさくなると同方針)
    }
    case '設置': {
      const v = e.value;
      const after = (e.phase === 'on_use' && e.timing === 'after_damage') ? '攻撃したあと、' : ''; // がんせきアックス・ひけん/ちえなみ
      // 交代で出てくるたびのダメージ量を層数ごとに出す(legacyに明記=戻すべき細部)
      const dmgT = () => {
        let d = e.damage_on_switch_in;
        // まきびしの標準ダメージ(データ未設定の技=ひけん・ちえなみ等)を補完
        if ((!Array.isArray(d) || !d.length) && v === 'まきびし') d = [{ layers: 1, fraction: 0.125 }, { layers: 2, fraction: 0.1667 }, { layers: 3, fraction: 0.25 }];
        if (!Array.isArray(d) || !d.length) return '';
        if (d.length === 1) return `(最大HPの${fracT(d[0].fraction)})`;
        return `(${d.map(x => `${x.layers}回で${fracT(x.fraction)}`).join('・')})`;
      };
      if (v === 'ステルスロック') return `${after}相手の場に とがった岩をうかべる。相手が交代で出てくるたびに、最大HPの${fracT(0.125)}ぶんダメージを与える(いわが弱点のタイプほど大きく、効きにくいタイプほど小さくなる。4倍弱点なら最大HPの${fracT(0.5)}・2倍弱点なら${fracT(0.25)}・等倍なら${fracT(0.125)})`; // 2026-06-18 数値例
      if (v === 'まきびし') return `${after}相手の場に まきびしをまく(最大${e.max_layers || 3}回まで重ねられる)。相手が交代で出てくるたびにダメージを与える${dmgT()}(「ひこう」タイプや特性「ふゆう」など地面にいない相手には効かない)`; // 2026-06-18
      if (v === 'どくびし') return `${after}相手の場に どくびしをまく。相手が交代で出てくると どく状態になる(2回重ねると もうどく。「ひこう」タイプや特性「ふゆう」など地面にいない相手には効かない)`; // 2026-06-18 ふゆう明示
      if (v === 'ねばねばネット' || v === 'sticky_web') return `${after}相手の場に ねばねばネットをはる。相手が交代で出てくると すばやさが1段階下がる(「ひこう」タイプや特性「ふゆう」など地面にいない相手には効かない)`; // 2026-06-18
      return /^[A-Za-z_]+$/.test(String(v || '')) ? `${after}相手の場に わなをしかける` : `${after}相手の場に「${v}」をしかける`;
    }
    case '設置除去':
      // ★2026-06-15: value(string)+trigger(phase=lasting)=「設置技の自動消滅条件」を訳す(どくびしの「どくタイプが出ると消える」等)。
      //   ※values(配列・active removal)は従来どおり「自分の場の…を消す」。
      if (typeof e.value === 'string' && e.phase === 'lasting') {
        if (e.auto_removed_by) {
          const ar = e.auto_removed_by;
          if (ar.type === 'poke_type_switch_in') return `「${ar.poke_type}」タイプのポケモンが場に出ると消える`;
        }
        return null; // 未訳のtrigger=出さない(機械漏れ防止)。データ側で auto_removed_by を構造化する。
      }
      if (!Array.isArray(e.values) || !e.values.length) return null; // 空リスト=出さない
      // ★target別に消す範囲を訳し分け(2026-06-17): all/field=両方・opponent=相手・team/既定=自分
      const where = (e.target === 'all' || e.target === 'field') ? '自分と相手、両方の場の'
        : (e.target === 'opponent_team' || e.target === 'opponent') ? '相手の場の' : '自分の場の';
      return `${where}「${e.values.join('」「')}」を消す`;
    case '壁設置': {
      // ★2026-06-15: prevents=配列(状態異常/こんらん予防系=しんぴのまもり)に対応。従来のreduces/multiplier(光の壁等)はそのまま。
      if (Array.isArray(e.prevents) && e.prevents.length) {
        let s = `${durT(e.duration)}の間、自分と味方を「${e.prevents.join('」「')}」にならないようにする`; // 2026-06-18 阿部さん: 自分も保護(しんぴのまもり)
        if (e.persists_through_switch) s += '。交代しても消えない';
        return s;
      }
      const r = e.reduces || [];
      const what = (r.includes('special_damage') && r.includes('physical_damage')) ? '物理技と特殊技'
        : r.includes('special_damage') ? '特殊技' : r.includes('physical_damage') ? '物理技' : '技';
      // multiplierが無い変則型は穴扱い=出さない(機械漏れ防止)
      if (e.multiplier == null) return null;
      let s = `${durT(e.duration)}の間、自分と味方が受ける${what}のダメージを${fracT(e.multiplier)}にする`;
      if (e.multiplier_multi != null) s += `(味方が2匹いるときは${fracT(e.multiplier_multi)})`; // ダブルバトル=2/3(ひかりのかべ等)
      s += `(急所には効かない)`;
      if (e.persists_through_switch) s += '。交代しても消えない';
      return s;
    }
    case '壁除去':
      // ★2026-06-15: 変化技(きりばらい等)で「こわしてから攻撃する」誤発火を防ぐ
      return (m && m.power && m.power > 0)
        ? `相手の「${(e.values || []).join('」「')}」をこわしてから攻撃する`
        : `相手の「${(e.values || []).join('」「')}」をこわす`;
    case '天候変化': {
      let s = `${durT(e.duration)}の間、天気を「${e.value}」にする`;
      // ★side_effects(構造化・あまごい/にほんばれ)を訳す: 技ダメージ倍率/状態異常予防
      for (const se of (e.side_effects || [])) {
        if (se.type === 'move_damage_multiplier') s += `。「${se.move_type}」タイプの技のダメージが${se.multiplier >= 1 ? `${se.multiplier}倍になる` : '半分になる'}`;
        else if (se.type === 'prevent_status') s += `。そのあいだ、ポケモンは「${se.value}」状態にならない`;
        else if (se.type === 'stat_multiplier') s += `。「${se.pokemon_type}」タイプのポケモンの「${STAT[se.stat] || se.stat}」が${se.multiplier}倍になる`; // 2026-06-18 ゆき/さむいギャグ等
      }
      return s;
    }
    case '天候必中':
      if (Array.isArray(e.cases)) {
        const parts = e.cases.map(c => (c.accuracy === '必中' || c.accuracy === 'never_miss')
          ? `「${c.weather}」のときは必ず当たる` : `「${c.weather}」のときは命中率が${c.accuracy}%になる`);
        return parts.join('。');
      }
      return (e.accuracy === 'never_miss' || e.accuracy === '必中') ? `天気が「${e.value}」のときは必ず当たる` : null;
    case '場の威力補正': {
      // ばくれつパンチ(特性条件) / フィールド(タイプ・地面条件で威力上下)
      const mt = e.move_type ? `「${e.move_type}」タイプの技の` : '';
      const dir = e.multiplier >= 1 ? '高くなる' : '下がる';
      // ★地面条件を内包(condT前置の重複を解消・グラス/エレキ/サイコ/ミスト)
      const c = e.condition || {};
      const subj = (c.type === 'user_grounded') ? '地面にいるポケモンが使う'
                  : (c.type === 'target_grounded') ? '地面にいるポケモンが受ける'
                  : (c.type === 'grounded') ? '地面にいるポケモンの'
                  : '';
      if (e.moves) return `${subj}${e.moves.map(x => `「${x}」`).join('')}の威力が${multT(e.multiplier)}`;
      return `${subj}${mt}威力が${dir}(${multT(e.multiplier)})`;
    }
    case '引き寄せ': {
      let s = `そのターン、相手の技を自分に引き寄せる`;
      if ((Array.isArray(e.exceptions) && e.exceptions.some(x => x.type === 'move_target')) || (Array.isArray(e.excludes_move_targets) && e.excludes_move_targets.length)) s += `(相手全体をまとめてねらう技は引き寄せられない)`; // このゆびとまれ・いかりのこな
      return s;
    }
    case 'フィールド展開':
      return `${durT(e.duration)}の間、足元を「${e.value}」にする`;
    case 'フィールド除去':
      return Array.isArray(e.values) && e.values.length ? `場の「${e.values.join('」「')}」を消す` : `場のフィールドを消す`; // ★略さない: データのフィールド全列挙(2026-06-26)
    case '一撃必殺':
      return `当たれば相手は 一発でひんしになる` + (e.ignores_type_matchup ? `(タイプ相性に関係なく当たる)` : ``); // じわれ
    case '暴れる(混乱)':
      return `${durT(e.duration)}の間、同じ技を出しつづける(ほかの行動はできない)`;
    case '連続強制(混乱なし)':
      return `${durT(e.duration)}の間、同じ技を出しつづける`;
    case '倍返し': {
      const cat = (e.basis || '').includes('physical') ? '物理技' : (e.category === '特殊' || (e.basis || '').includes('special')) ? '特殊技' : '技';
      return `先に相手の${cat}を受けてから、そのダメージの${e.multiplier || 2}倍を返す(タイプ相性は関係なく当たる)` +
        (e.doubles_note ? `(ダブルバトルでは、最後に受けた${cat}のダメージだけを返す)` : ``) +
        (e.requires_damage_taken ? `(そのターンにダメージを受けていないと失敗する)` : ``); // 2026-06-17: メタルバースト等
    }
    case '特性上書き': {
      const exAbil = (e.exceptions || []).flatMap(x => x.values || []);
      const exC = exAbil.length ? `(ただし「${exAbil.join('」「')}」などの特別な特性はコピーできない)` : ``;
      const exF = exAbil.length ? `(ただし「${exAbil.join('」「')}」など一部の特別な特性のときは失敗する)` : ``; // なやみのタネ
      if (e.source === 'opponent_ability') return `相手の特性を、自分の特性としてコピーする${exC}`;
      if (e.value === '自分の特性') return `相手の特性を、自分と同じ特性に変える`;
      if (e.value) return `相手の特性を「${e.value}」に変える${exF}`; // なやみのタネ: ふみんに変える + 失敗条件
      return `相手の特性を 上書きする`;
    }
    case '特性交換': {
      const exAbil = (e.exceptions || []).flatMap(x => x.values || []);
      return `自分と相手の特性を入れかえる` + (exAbil.length ? `(ただし「${exAbil.join('」「')}」などの特別な特性は入れかえられない)` : ``); // スキルスワップ
    }
    case '特性無効化': {
      const exAbil = (e.exceptions || []).flatMap(x => x.values || []);
      return `相手の特性を、場にいる間きかなくする` + (exAbil.length ? `(ただし「${exAbil.join('」「')}」など、すがた変化などに使う特別な特性には効かない)` : ``); // いえき
    }
    case '技タイプ変更':
      if (e.mapping) {
        const ex = Object.entries(e.mapping).map(([k, v]) => `「${k}」なら${v}`).join('・');
        // ★2026-06-15: マッピングキーから天気/フィールドを判定(だいちのはどう=フィールド・ウェザーボール=天気)
        const isField = Object.keys(e.mapping).some(k => /フィールド/.test(k));
        const ctx = isField ? 'フィールド' : '天気';
        const fieldNote = isField ? `(さらにフィールドによる1.3倍の効果も重ねてかかる)` : ``; // 2026-06-18 だいちのはどう
        return `${ctx}によって技のタイプが変わる(${ex}。${ctx}がなければ${e.default_type || 'ノーマル'})${fieldNote}`;
      }
      if (e.type_by_form) {
        const ex = Object.entries(e.type_by_form).map(([k, v]) => `「${k}」のときは${v}`).join('・');
        return `すがたによって技のタイプが変わる(${ex})`;
      }
      if (Array.isArray(e.values)) return `すがたによって技のタイプが「${e.values.join('」「')}」に変わる`;
      // ★2026-06-28 全国版: 個体値/タイプ1/テラス/道具/きのみ 由来
      if (e.by === 'individual_values') return `技のタイプが、自分の個体値によって変わる`;
      if (e.by === 'user_type1') return `技のタイプが、自分のタイプ1と同じになる(テラスタル中はテラスタイプになる)`;
      if (e.by === 'held_berry' || (e.condition && e.condition.value === 'きのみ')) return `持っている「きのみ」によって、技のタイプが変わる`;
      if (e.condition && e.condition.type === 'user_terastalized') return `テラスタル中は、技のタイプが自分のテラスタイプになる`;
      if (e.condition && e.condition.type === 'held_item') return `持たせた「${e.condition.value}」の種類によって、技のタイプが変わる`;
      return null;
    case 'タイプ上書き':
      // ミラータイプ等は value が機械値(copy_target_current_types)→意味で訳す。テラスタル分岐(未解禁)はカッコ書きで残す。
      if (e.value === 'copy_target_current_types') {
        const tera = (!SYSTEMS_IN_GAME.tera && /テラスタル/.test(e.note || '')) ? `（相手がテラスタルしているときはそのテラスタイプをコピーする。ステラのときは元のタイプをコピーする）` : '';
        return `自分のタイプを、相手と同じタイプに変える${tera}`;
      }
      // ★2026-06-29 target=self(テクスチャー/テクスチャー2/ほごしょく等)。by判別で動的タイプを訳す(undefined防止)
      if (e.target === 'self') {
        if (e.by === 'first_move') return `自分のタイプを、自分の一番上の技と同じタイプに変える`;
        if (e.by === 'resist_last_foe') return `自分のタイプを、相手が最後に使った技を効きにくくするタイプの中からランダムに1つ選んで、それに変える`;
        if (e.by === 'terrain') return `自分のタイプを、戦っている場所(地形)に合ったタイプ1つに変える(すでにそのタイプのときは失敗する)`;
        return e.value && !/^[A-Za-z_]+$/.test(String(e.value)) && !/応じた|ランダム/.test(e.value) ? `自分のタイプを「${e.value}」に変える` : `自分のタイプを変える`;
      }
      return /^[A-Za-z_]+$/.test(String(e.value || '')) || !e.value ? `相手のタイプを変える` : `相手のタイプを「${e.value}」だけに変える`;
    case 'タイプ追加':
      return `相手に「${e.value}」タイプを追加する`;
    case 'タイプ除去':
      return `攻撃したあと、自分の「${e.value}」タイプがなくなる`; // 2026-06-18 もえつきる: 攻撃後タイミング
    case 'タイプ一時無効':
      return `そのターンだけ、自分の「${e.value}」タイプがなくなる`;
    case '技タイプ追加':
      return `この技は「${e.value}」タイプも合わさったあつかいになる`;
    case '失敗ダメージ':
      // ★外れだけでなく「まもる等で防がれて失敗」も含む(とびひざげり/かかとおとし/サンダーダイブ・legacy明記)
      return `外れたり、「まもる」などで防がれて失敗したとき、自分が最大HPの${fracT(e.fraction)}ぶんダメージを受ける`;
    case '状態異常予防': {
      // ★values列挙(エレキ=ねむり/ねむけ)・note補足(エレキ=起こさない/ミスト=治らない)
      // ★地面条件は clause が「地面にいるポケモンは」を内包(condT前置の重複を解消・エレキ/ミスト)
      const c = e.condition || {};
      const subj = (c.type === 'grounded' || c.type === 'user_grounded' || c.type === 'target_grounded') ? '地面にいるポケモンは' : '';
      const ex = (c.excludes_types || c.excludes_abilities) ? `(ひこうタイプや特性「ふゆう」などはのぞく)` : '';
      let body;
      if (Array.isArray(e.values) && e.values.length) body = `「${e.values.join('」「')}」状態にならない`;
      else if (e.value === 'ねむり') body = `ねむれなくなる`;
      else body = subj ? `状態異常にならない` : `状態異常をふせぐ`; // 主語が「地面にいるポケモンは」なら「ならない」が自然(ミスト)
      let s = subj ? `${durT(e.duration)}の間、${subj}${body}` : `${durT(e.duration)}の間、${body === 'ねむれなくなる' ? '場のどのポケモンも ねむれなくなる' : body}`;
      if (ex) s += ex;
      if (/起こさない/.test(e.note || '')) s += `(すでに眠っているポケモンは目を覚まさない)`;
      else if (/治らない/.test(e.note || '')) s += `(すでにかかっている状態異常は治らない)`;
      return s;
    }
    case '条件威力倍率':
      return `${(e.prob && e.prob < 100) ? `${e.prob}%くらいの確率で、` : ``}威力が${multT(e.multiplier)}`; // きまぐレーザー
    case '威力段階増加':
      return `ひんしになった味方の数が多いほど威力が高くなる(1体ごとに+${e.power_increment})`;
    case 'ランク数威力加算':
      return `自分の能力ランクが上がっているほど威力が高くなる(1段階ごとに+${e.add_per_stage})`;
    case '強制交代(吹き飛ばし)':
      return `相手をむりやり交代させる(出てくる相手はランダム)`;
    case '強制交代(攻撃)':
      // ダメージは通るが交代だけダイマックス相手に無効(ともえなげ/ドラゴンテール)。未解禁はカッコ書きで残す(2026-06-17)。
      return `攻撃して、相手をむりやり交代させる(出てくる相手はランダム)` +
        (e.no_switch_if_target_dynamax ? (SYSTEMS_IN_GAME.dynamax ? `。ダイマックスしている相手は、むりやり交代させられない(ダメージは当たる)` : `（ダイマックスしている相手は、むりやり交代させられない。ダメージは当たる）`) : ``);
    case '持ち物奪取': {
      // 「自分が何も持っていない時だけ」+「ただしはたきおとすで自分の道具が無効化されているときは奪える」+「トレーナー戦で返される」
      let s = `相手の持ち物をうばう(自分が何も持っていないときだけ。ただし自分の道具が「はたきおとす」で使えなくなっているときは、奪って入れかえることができる)`;
      if (e.returned_after_trainer_battle || e.returns_after_battle_vs_trainer) s += `。トレーナーとのバトルでは、終わるとうばった道具は返される`;
      return s;
    } // どろぼう・ほしがる 2026-06-17
    case '持ち物排除': {
      // ★2026-06-15: target=all(ふしょくガス)は場全員に効く。target=opponent(はたきおとす)は相手だけ。
      const rest = e.restored_after_battle ? `。バトルが終わると道具は元にもどる` : ``; // はたきおとす
      const destroy = e.mode === 'destroy' ? `(道具自体がなくなる)` : ``; // 2026-06-18: ふしょくガスは消滅
      if (e.target === 'all' || e.target === 'all_but_self') return `場の全員の(道具を持っているポケモンの)持ち物を、使えなくする${destroy}${rest}`;
      return `相手の持ち物をはたき落として、使えなくする${destroy}${rest}`;
    }
    case '持ち物交換':
      return `自分と相手の持ち物を入れかえる` + ((e.note || e.detail) ? `(どちらか一方しか道具を持っていなくても成功する)` : ``); // トリック・すりかえ
    case '持ち物復活':
      return `自分が最後に使った道具を元にもどす`; // ★2026-06-17: 「1回だけ」は誤情報(リサイクルは何度でも使える)
    case 'PP減少': {
      const n = e.value != null ? e.value : e.amount; // ぶきみなじゅもんは amount キー
      return n != null ? `相手が最後に使った技のPPを${n}へらす` : `相手が最後に使った技のPPを大きくへらす`;
    }
    case '部屋系':
      // ★2026-06-15: マジックルーム(道具無効)/ワンダールーム(防御入替)の区別 — swap_stats の有無で判定
      if (Array.isArray(e.swap_stats) && e.swap_stats.length) {
        return `${durT(e.duration)}の間、場の全員の「ぼうぎょ」と「とくぼう」が入れかわる(もう一度使うと元にもどる)`;
      }
      return `${durT(e.duration)}の間、場の全員の道具の効果がなくなる(もう一度使うと元にもどる)`;
    case 'トリックルーム':
      return `${durT(e.duration)}の間、すばやさが低いポケモンから先に行動する(ただし優先度のある先制技には効かない。もう一度使うと元にもどる)`; // 2026-06-18
    case 'じゅうりょく':
      return `${durT(e.duration)}の間、場の全員の命中率が5/3倍くらいになり、ひこうタイプや特性「ふゆう」で浮いているポケモンも地面にいるあつかいになる。「そらをとぶ」「とびはねる」「フリーフォール」「はねる」「とびげり」「とびひざげり」「でんじふゆう」「フライングプレス」などの空中に行く技は使えなくなり、使っている最中なら中止される`; // 2026-06-18: 使用不可技列挙
    case '必ず急所':
      return `必ず急所に当たる`;
    case 'ランク無視':
      return `相手の能力ランクの変化を無視して攻撃する`;
    case 'ランクリセット':
      return `相手の能力ランクの変化をすべて元にもどす`;
    case 'ランクコピー':
      return `相手のすべての能力ランクの変化を、そのまま自分にコピーする`; // じこあんじ(copies='all stat ranks')
    case 'ランク反転':
      // ★2026-06-19 新技対応: ひっくりかえす(カラマネロ)
      return `相手の能力ランクの上がりさがりを、すべて反対にする(+1なら-1、-2なら+2)`;
    case '別防御参照ダメージ':
      return `特殊技だが、相手の「ぼうぎょ」でダメージを計算する`;
    case '別能力ダメージ': {
      const us = STAT[e.use_stat] || 'ぼうぎょ', io = STAT[e.instead_of] || 'こうげき';
      return `ふつうは「${io}」でダメージを計算するが、この技は自分の「${us}」${e.includes_stat_stages ? '(ランクの変化もふくむ)' : ''}で計算する`; // ボディプレス
    }
    case '相手能力ダメージ':
      return `自分の「こうげき」は使わず、相手の「こうげき」の高さでダメージを計算する(相手が強いほど痛い)`; // イカサマ
    case '物理特殊自動':
      return `物理と特殊のうち、ダメージが大きいほうで攻撃する`;
    case '相手持ち物威力':
      return `相手の持ち物を使って攻撃する。相手が持ち物を持っていないと失敗する` + (e.negates_item === false ? `(相手の道具を消したり、効果を止めたりはしない)` : ``); // ポルターガイスト
    case '相性上書き':
      return `「${e.against_type}」タイプの相手に こうかばつぐんになる(以前の作品までの仕様で、いまの作品では変わっている場合があります)`; // 2026-06-18 フリーズドライ等(SV→過去の作品 機械漏れ防止)
    case 'やどりぎ':
      return `相手に タネをうえつける。毎ターン相手のHPを最大HPの${fracT(e.fraction)}吸い取って、自分のHPを回復する${e.carries_over_on_user_switch ? '(自分が交代しても、相手のタネの効果は続く)' : ''}(くさタイプには効かない)`;
    case 'みちづれ':
      return `自分が次に行動する前に相手の技でひんしになると、その相手も道づれにする(続けて使うと失敗する)`; // 2026-06-17
    case 'ほろびのうた':
      return `使った時に場にいた全員(自分も含む)が、${e.duration || 3}ターン後にひんしになる(交代するとのがれられる)`; // 2026-06-17: 自分も含むを明示
    case 'ロックオン':
      return `次のターンにこの相手へ使う技が、必ず当たるようになる(1ターン限り)`; // 2026-06-18
    case 'メロメロ付与':
      return `相手を「メロメロ」状態にする(異性にだけ効く・性別不明のポケモンには失敗する)。「メロメロ」の相手は50%の確率で動けなくなる`; // 2026-06-17
    case 'アンコール':
      return `${durT(e.duration)}の間、相手は直前に使った技しか出せなくなる` + (e.ends_if ? `(その技のPPがなくなると、もとにもどる)` : ``) +
        `(ただし、相手の直前の技が「ものまね」「ゆびをふる」「オウムがえし」「へんしん」「わるあがき」「スケッチ」「ねごと」「アンコール」「しぜんのちから」「ねこのて」「さきどり」「まねっこ」のいずれかなら失敗する)`; // 2026-06-18
    case 'ちょうはつ':
      return `${durT(e.duration)}の間、相手は変化技を出せなくなる`;
    case 'いちゃもん':
      return `相手は同じ技を続けて出せなくなる`;
    case 'かなしばり':
      return `相手が最後に使った技を、${durT(e.duration)}の間 出せなくする`;
    case 'ふういん':
      return `自分が場にいる間、自分も知っている技を相手は使えなくなる`; // duration=自分が場を離れるまで
    case 'カテゴリ封じ':
      return `${durT(e.duration)}の間、相手は音の技${Array.isArray(e.blocked_moves) && e.blocked_moves.length ? `(「${e.blocked_moves.join('」「')}」)` : ''}を出せなくなる`; // じごくづき blocked_moves 全列挙(2026-06-17 阿部さん)
    case '全員逃走不可':
      return `${durT(e.duration)}の間、おたがい逃げたり交代したりできなくなる(ゴーストタイプはのぞく)`;
    case '拘束解除':
      // ★values(キラースピン)があれば対象技を列挙(こうそくスピンと同様に省略しない)
      if (Array.isArray(e.values) && e.values.length) return `自分が受けている「${e.values.join('」「')}」の効果をふりほどく`; // キラースピン: 「など」削除、データ全列挙(2026-06-17 阿部さん)
      return `自分にかかったバインドなどの状態をふりほどく`;
    case '自分拘束':
      // ★2026-06-15: HPまわりは「回復」kindが言うので、ここは「地面に根をはる(交代できなくなる)」に絞る。「逃げる」は野生用語=避ける。
      return `地面に根をはって、交代できなくなる`;
    case 'いたみわけ':
      return `自分と相手の今のHPを合わせて、半分ずつに分ける`;
    case '実数値折半':
      return `自分と相手の${joinStats(statList(e))}の数値を合わせて、半分ずつにする`;
    case 'たくわえ加算':
      // ★ぼうぎょ・とくぼう上昇は能力ランク変化kindが言う→重複を除き、note(のみこむ/はきだす強化)を出す(たくわえる)
      return `「たくわえ」を1つためる(最大${e.max || 3}つ)。ためるほど「のみこむ」「はきだす」の効果が大きくなる`;
    case 'たくわえ消費':
      return `ためた「たくわえ」を使いきって、上がっていたぼうぎょ・とくぼうを元にもどす`;
    case '能力入替': {
      const sts = statList(e);
      // ★2026-06-15: targets=[self,opponent] (スピードスワップ等) は実数値の入替 / target=opponent (パワースワップ等) はランク変化の入替 / target=self (パワートリック) は自分内の数値入替
      if (e.target === 'self' && !e.effect && !e.detail) return `自分の${joinStats(sts)}の数値を入れかえる(ランクは変わらない)`;
      if (Array.isArray(e.targets) && e.targets.includes('self') && e.targets.includes('opponent')) {
        return `自分と相手の${joinStats(sts)}の数値を入れかえる`;
      }
      return `自分と相手の${joinStats(sts)}のランクの変化を入れかえる`;
    }
    case '能力ランク変化_リセット': // 予備
    case '直後に行動':
      return `この技を使ったあと、相手はすぐ次に行動する`;
    case '最後に行動':
      return `そのターン、相手の行動を一番最後にする`;
    case '相手技タイプ変更':
      return `相手より先に使うと、そのターン、相手のその技を「${e.value}」タイプに変える`; // そうでん(phase=this_turn)
    case '木の実強制':
      // ★2026-06-15: target別に言い分け
      //   self (ほおばる): 自分が食べる
      //   opponent (むしくい・きのみせんじゅつ等): 相手から奪って自分が使う(Bulbapedia確認)
      //   all (おちゃかい): 場の全員がそれぞれ食べる
      //   team (ふるいたてる等): 味方が食べる
      if (e.target === 'self') return `自分が持っている「きのみ」を、その場ですぐに使う(食べる)`;
      if (e.target === 'all' || e.target === 'all_but_self') return `場の全員が、それぞれ持っている「きのみ」を、その場ですぐに使う(食べる)`;
      if (e.target === 'team') return `味方が持っている「きのみ」を、その場ですぐに使う(食べる)`;
      return `相手が持っている「きのみ」を奪って、その場で自分が使う(食べる)`;
    case '木の実奪取食':
      return `相手の持っているきのみをうばって、自分で食べる(バトルで効果のあるきのみだけが対象)`; // 2026-06-18 ついばむ
    case 'やけど低下無視':
      return `やけどでこうげきが下がっていても、下がっていないあつかいで攻撃する`;
    case '次技威力倍化':
      return `次に出す「${e.move_type}」タイプの技の威力が${e.multiplier}倍になる(「${e.move_type}」タイプの技を1回出すまで効果が続き、出すと消える)`; // 2026-06-18: 1回限りを明示(じゅうでん uses=1)
    case '味方威力上昇':
      return `そのターン、味方の技の威力が${multT(e.multiplier)}`;
    case '命中率固定':
      return `命中率が${e.value}%になる` + (e.else_value != null ? `(そうでないときは命中率${e.else_value}%)` : ``); // ぜったいれいど
    case 'ランダム技':
      return `自分が覚えている技の中から、ランダムで1つ出す` + (e.pp_cost === 'this_move_only' ? `(へるPPはこの技のぶんだけで、出した技のPPは減らない)` : ``); // ねごと
    case '直前技模倣':
      return `直前にだれかが使った技を、自分も出す(自分が使った技もふくむ)`; // 2026-06-18 まねっこ
    case '技強制再使用':
      return `相手に、直前に使った技をもう一度すぐ出させる(反動のある技・2ターン技・複数ターン続く技・チャージ技・はかいこうせんなどには失敗する)`; // 2026-06-18 さいはい
    case '遅延攻撃':
      return `${e.delay_turns || 2}ターン後に、その場所にいる相手へ攻撃が当たる(最初の相手が引っこんでいても、同じ場所のポケモンに当たる)${e.type_matchup_applies ? '。タイプ相性も計算される' : ''}`; // みらいよち
    case '接触反動':
      // 自己完結文(条件込み)→ SELF_CONTAINED_COND で condT 前置を抑制(ニードルガードの条件二重を解消)
      return `守っている間に直接攻撃をしてきた相手は、最大HPの${fracT(e.fraction)}のダメージを受ける`;
    case '優先技無効':
      return `${durT(e.duration)}の間、地面にいるポケモンは相手の先制技を受けなくなる`;
    case '次ターン使用不可':
      return `この技は2ターン続けて出せない`;
    case 'みがわり設置':
      // ★2026-06-18 阿部さん指摘 + ポケモンWiki裏取り: 正確な仕様を網羅。
      //   ①最大HPの1/4だけ自分のHPを減らして、その分のHPを持つ「みがわり」を作る
      //   ②みがわりが攻撃のダメージを肩がわり(=本体は減らない)。みがわりのHPが0になると壊れる
      //   ③みがわりが壊れたあとは、攻撃は本体に当たる
      //   ④連続攻撃の途中で壊れた場合、残りのヒットは本体に当たる(つららばり/ドラゴンアロー等)
      //   ⑤状態異常・能力ランク変化などはみがわりを貫通しない
      //   ⑥音系の技・特性「すりぬけ」・天候/フィールド変化は貫通する
      //   ⑦ダイマックス技は防げるが、自分がダイマックスするとみがわりは消える(ゲート中=カッコ書き)
      return `自分のHPを最大HPの${fracT(0.25)}だけ減らし、減らしたぶんのHPを持つ「みがわり」を作る。「みがわり」のHPが0になるまで、攻撃のダメージを肩がわりする(壊れたあとは本体に当たる。連続攻撃の途中で壊れた場合、残りのヒットは本体に当たる)。「みがわり」は状態異常や能力ランクの変化を受けない(ただし、音系の技や特性「すりぬけ」などはそのまま本体が受ける)` +
        (SYSTEMS_IN_GAME.dynamax ? `。ダイマックス技は防げるが、自分がダイマックスすると「みがわり」は消える` : `（ダイマックス技は防げるが、自分がダイマックスすると「みがわり」は消える）`);
    case 'へんしん':
      return `相手のすがた・能力値・個体値・能力ランクの変化・特性・覚えている技をそっくりコピーして、相手と同じポケモンになる。ただし自分のHP・持ち物・状態異常はそのまま変わらない。コピーした技のPPはどれも5になる。交代すると元のすがたにもどる`; // 2026-06-18: 個体値を追加
    case 'なげつける':
      return `持っている道具を投げつけて攻撃する。道具によって威力や追加効果が変わる${e.consumes_user_item ? '。投げた道具はなくなる' : ''}`;
    // ===== 2026-06-14 残り10技の小さな穴を開通 =====
    case '能力倍率': {
      // 条件(いわタイプ等)はcompose側がcondTで前置するので、ここはbareに
      const st = STAT[e.stat] || e.stat;
      return `${st}が${multT(e.multiplier)}`;
    }
    case '全体継続ダメージ':
      return `毎ターン終わりに、最大HPの${fracT(e.fraction)}ダメージを受ける`;
    case '地面技被弾化':
      return `ひこうタイプや特性「ふゆう」で浮いていても、地面にいるあつかいになる(じめん技が当たる)`;
    case '対象範囲変更':
      return `サイコフィールドで自分が地面にいると、相手全体に当たるようになる` + (e.spread_multiplier_in_doubles != null ? `(ダブルバトルでは、それぞれへのダメージが${fracT(e.spread_multiplier_in_doubles)}倍になる)` : ``); // 2026-06-18: ワイドフォース 0.75→3/4分数化(機械漏れ防止)
    case '条件付き優先':
      // 自己完結文(条件込み)。compose側はこのkindがある時 priority行を出さない+ゴミ条件文も前置しない
      return e.priority ? `グラスフィールドで自分が地面にいる(ひこうタイプや特性「ふゆう」などは除く)と、優先度+${e.priority}で先に攻撃できる(ふだんは優先度0)` : null; // 2026-06-18 グラススライダー除外例明示
    case '行動順繰上げ':
      return `そのターン、すばやさに関係なく、味方の行動順を自分のすぐ後ろにする`; // りんしょう
    case '位置入替':
      return `自分と味方の立ち位置を入れかえる` + (e.consecutive_success_multiplier != null ? `(最初は必ず成功するが、2回目以降は続けて使うたびに成功する確率が${fracT(e.consecutive_success_multiplier)}になる。失敗するともとにもどる)` : ``); // 2026-06-18: サイドチェンジ 初回確実を明示
    // ★2026-06-29 みねうち/てかげん: この技で相手は瀕死にならずHPが1残る
    case '瀕死回避':
      return `この技のダメージでは相手はひんしにならず、HPが${e.leaves_hp || 1}だけのこる`;
    // ★2026-06-28 全国版の場操作・道具操作系を新kindで追加(effects→sim土台。説明文オーバーレイから移行)
    case '場入れ替え':
      return `おたがいの場の状態(リフレクター・ひかりのかべ・オーロラベール・おいかぜ・しんぴのまもり・しろいきり・ステルスロック・まきびし・どくびし・ねばねばネット)を、自分側と相手側で入れかえる(残りターン数は引きつがれる)`; // コートチェンジ
    case 'ランク低下防御':
      return `${durT(e.duration)}の間、自分と味方の能力ランクが、相手の技で下げられなくなる(交代しても効果は続く)`; // しろいきり
    case '地形依存技':
      return `今いる地形に合わせて別の技に変わって出る(草むらならエナジーボールなど)。ふつうの場所では「トライアタック」になる`; // しぜんのちから
    case '跳ね返し':
      return `そのターン、自分が受けた変化技を、使ってきた相手に跳ね返す`; // マジックコート(優先度は技のpriorityが別途出す)
    case 'おんねん':
      return `この技を使ったあと、相手の攻撃でひんしになると、その相手の技のPPをすべて0にする`; // おんねん
    case 'よこどり':
      return `相手が使おうとした、能力ランクを変える技や回復の技を横どりして、自分にかける`; // よこどり
    case '道具封じ':
      return `${durT(e.duration)}の間、相手は持っている道具を使えなくなる`; // さしおさえ
    case '急所無効':
      return `${durT(e.duration)}の間、相手の攻撃が、自分や味方の急所に当たらなくなる`; // おまじない
    case 'さきどり':
      return `相手が出そうとしている攻撃技を先どりして使い、威力を${e.multiplier || 1.5}倍にする(後攻になったときや、相手が変化技を選んでいるときは失敗する)`; // さきどり
    case 'テレキネシス':
      return `${durT(e.duration)}の間、相手をうかせて、相手への技が必ず当たるようになる(じめんの技は当たらなくなる)`; // テレキネシス
    case '道具譲渡':
      return `自分が持っている道具を相手にわたす(相手がすでに道具を持っているときは失敗する)`; // ギフトパス
    case '賞金倍':
      return `戦闘が終わったあとにもらえる賞金が2倍になる`; // ハッピータイム
  }
}
function compose(m) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  const holes = [], groups = [];
  for (const e of eff) {
    // ★溜めターン発動の能力上昇は「2ターン目に攻撃」の文に織り込み済→単独では出さない(二重防止)。
    if (e.kind === '能力ランク変化' && e.on_charge_turn && eff.some(x => x.kind === '2ターン目に攻撃')) continue;
    // ★みがわりのHPコストは「みがわり設置」clauseが言う→単独の「HPが減る」は出さない(みがわり=二重防止)
    if (e.kind === 'HPが減る' && eff.some(x => x.kind === 'みがわり設置')) continue;
    if (isFullyGated(e)) continue; // 未解禁システム専用の効果=穴でなくゲート(skip)
    const c = clause(e, m); if (!c) { holes.push(e.kind); continue; }
    const key = e.condition ? JSON.stringify(e.condition) : '';
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, cond: e.condition, cl: [] }; groups.push(g); }
    g.cl.push({ text: c, kind: e.kind });
  }
  // clauseが条件込みで自己完結するkind=condTを前置しない(「次のどれかの時:」漏れ防止・ねをはる)
  const SELF_CONTAINED_COND = new Set(['地面技被弾化', '条件付き優先', '接触反動']);
  // ★grounded時に「地面にいるポケモンは」をclauseが内包するkind(フィールド技の「地面にいる時」重複・係り解消)
  const GROUNDED_SELF = new Set(['状態異常予防', '場の威力補正', '優先技無効', '回復']);
  const isGroundedCond = c => c && (c.type === 'grounded' || c.type === 'user_grounded' || c.type === 'target_grounded');
  const sentences = groups.map(g => {
    // ★条件付きgroup(2026-06-17 阿部さん指摘): 同じconditionで複数clauseを「。」で繋ぐと2文目が条件と切れて常時に見える(のしかかり等)。
    //    例: 「相手が『ちいさくなる』を使っている時、威力が2倍になる。必ず命中する」 → 「…、威力が2倍になり、さらに必ず命中する」
    const sep = (g.cond && g.cl.length > 1) ? '、さらに' : '。';
    const body = g.cl.map((cl, i) => {
      let txt = cl.text;
      // 連続する「攻撃したあと、」を2回目以降は消す(スケイルショット=ぼうぎょ-1+すばやさ+1 を1文にまとめる)
      if (i > 0 && txt.startsWith('攻撃したあと、') && (g.cl[i - 1].text || '').startsWith('攻撃したあと、')) {
        txt = txt.replace(/^攻撃したあと、/, '');
      }
      // condition共有時は連用形化(「…なる」→「…なり」)で「、さらに」と繋ぐ
      if (i < g.cl.length - 1 && sep === '、さらに') {
        txt = txt.replace(/なる$/, 'なり').replace(/する$/, 'し');
      }
      return (i > 0 && cl.kind === '能力ランク変化' && g.cl[i - 1].kind === 'HPが減る') ? 'そのかわり、' + txt : txt;
    }).join(sep);
    // 条件文がゴミ(⚠️要調査=condStrNewが訳しきれない複雑条件)なら前置しない=clauseが自己完結で意味を持つ
    const selfContained = g.cl.every(cl => SELF_CONTAINED_COND.has(cl.kind))
      || (isGroundedCond(g.cond) && g.cl.every(cl => GROUNDED_SELF.has(cl.kind))); // groundedはclause内包=前置スキップ
    const ct = (g.cond && !selfContained) ? condT(g.cond) : '';
    return (ct && !ct.includes('未対応')) ? `${ct}、${body}` : body;
  });
  let text = sentences.length ? sentences.join('。') + '。' : '';
  const bd = m.battle_data || {};
  // ★使用条件(requires)を前置(2026-06-15): データに在るのにcompose未発声だった取りこぼし(いびき露呈例)。
  // ※accuracy_check(どくタイプ必中=どくどく)は使用ゲートでないのでここでは扱わない。
  const reqT = r => {
    if (r.type === 'self_status') return `自分が「${r.value}」状態の時だけ使える`;
    if (r.type === 'weather') return `天気が「${r.value}」の時だけ使える`;
    if (r.type === 'all_other_known_moves_used') return `自分が覚えている他の技を全部使うと、使えるようになる`;
    if (r.type === 'user_has_eaten_berry') return `「きのみ」を食べると、使えるようになる`;
    if (r.type === 'first_turn_after_switch_in') return `出てきた最初のターンしか成功しない`;
    return null;
  };
  const reqStr = (bd.requires || []).map(reqT).filter(Boolean).map(s => s + '。').join('');
  if (reqStr) text = reqStr + text;
  // ★優先度を説明に入れる(2026-06-07 阿部さん): battle_data.priority(構造)から。
  // ただし「条件付き優先」kind(グラススライダー等)がある時は二重になるので出さない(clauseが条件込みで喋る)。
  const pr = bd.priority;
  const hasCondPrio = eff.some(e => e.kind === '条件付き優先');
  if (typeof pr === 'number' && pr !== 0 && !hasCondPrio) {
    // ★2026-06-19 阿部さん指摘: 既存先制技の description「優先度+1の先制技。」と揃える(新技も同じ表現に)
    text = (pr > 0 ? `優先度+${pr}の先制技。` : `優先度${pr}の後攻技。`) + text;
  }
  const lo = (bd.fails_if || []).find(f => f.type === 'current_hp_below_fraction');
  if (lo) text += `(今のHPが最大HPの${fracT(lo.fraction)}より少ないと失敗する)`;
  // ★2026-06-18 阿部さん指摘: みがわり等は current_hp_at_or_below_fraction(1/4以下) で失敗 (ポケモンWiki裏取り済)
  const loEq = (bd.fails_if || []).find(f => f.type === 'current_hp_at_or_below_fraction');
  if (loEq) text += `(今のHPが最大HPの${fracT(loEq.fraction)}以下のときは失敗する)`;
  const ais = (bd.fails_if || []).find(f => f.type === 'ally_already_in_state');
  if (ais) text += `(味方がすでに「${ais.value}」状態だと失敗する)`;
  // ★2026-06-15: ねこだまし系(出てきた最初のターンしか成功しない)
  if ((bd.fails_if || []).some(f => f.type === 'not_users_first_turn_on_field')) {
    text += `(出てきた最初のターンしか成功しない)`;
  }
  // ★2026-06-15: きあいだめ系(すでに同じ状態のときは失敗)
  const uas = (bd.fails_if || []).find(f => f.type === 'user_already_in_state');
  if (uas) text += `(自分がすでに「${uas.value}」状態のときは失敗する)`;
  // ★2026-06-17 阿部さん全数スキャン: 新規 fails_if を訳出
  for (const f of (bd.fails_if || [])) {
    if (f.type === 'hit_by_attacking_move_before_use') text += `(攻撃するまでに相手の技を受けると失敗する)`; // きあいパンチ
    else if (f.type === 'target_not_selecting_attacking_move') text += `(相手がそのターンに攻撃技を選んでいない・既に行動済みのときは失敗する)`; // ふいうち
    else if (f.type === 'target_not_selecting_priority_move') text += `(相手がそのターンに先制技を選んでいない・既に攻撃済みのときは失敗する)`; // はやてがえし
    else if (f.type === 'user_not_type') text += `(自分が「${f.value}」タイプでないときは失敗する)`; // もえつきる
    else if (f.type === 'no_stockpile') text += `(「たくわえる」を1度も使っていないときは失敗する)`; // はきだす/のみこむ
    else if (f.type === 'user_holding_item') text += `(すでに道具を持っているときは失敗する)`; // リサイクル
    else if (f.type === 'no_field_active') text += `(フィールドが何もないときは失敗する)`; // アイアンローラー
    else if (f.type === 'no_damage_dealt_last_turn') text += `(前のターンに相手にダメージを与えていないときは失敗する)`; // ★2026-06-19 どげざつき
  }
  // ★2026-06-15: どくどく系(自分が特定タイプなら必中)= accuracy_check の bypass_if を訳す
  const acc = (bd.requires || []).find(r => r.type === 'accuracy_check' && r.bypass_if);
  if (acc && acc.bypass_if.type === 'user_type_in') {
    text += `「${(acc.bypass_if.values || []).join('」「')}」タイプが使うと必ず命中する。`;
  }
  const gi = (bd.immune || []).find(x => x.type === 'target_type' && (x.value === 'ゴースト' || (x.values || []).includes('ゴースト')));
  if (gi) text += `(ゴーストタイプには当たらない)`;
  // ★2026-06-15: タイプ/特性/道具による免疫を一律で訳す(状態付与の粉技・能力ダウン技で大量取りこぼしだった)。
  //   既存ハンドラ(ゴースト・dynamax_target)はスキップ。設置技の on_switch_in_pokemon もここで訳す。
  //   設置 clause で「地面にいない相手には効かない」を既に言っている場合、特性「ふゆう」/not_grounded は重複なので飛ばす。
  const arr = x => Array.isArray(x.values) ? x.values : (x.value != null ? [x.value] : []);
  const hasGround = /地面にいない相手には効かない/.test(text);
  const immuneT = (im) => {
    const v = arr(im).map(x => String(x).replace(/タイプ$/, ''));
    if (!v.length) return null;
    if (im.type === 'target_type' || im.type === 'type' || im.type === 'on_switch_in_pokemon' || im.type === 'target_type_in' || im.type === 'pokemon_type' || im.type === 'target_is_type') {
      if (v.length === 1 && v[0] === 'ゴースト') return null; // 既存ハンドラ
      return `「${v.join('」「')}」タイプには効かない`;
    }
    if (im.type === 'ability' || im.type === 'target_ability') {
      if (hasGround && v.length === 1 && v[0] === 'ふゆう') return null; // 「地面にいない」に内包
      return `特性「${v.join('」「')}」のポケモンには効かない`;
    }
    if (im.type === 'item' || im.type === 'target_item' || im.type === 'held_item') {
      return `「${v.join('」「')}」を持つポケモンには効かない`;
    }
    if (im.type === 'ally_ability') { // いのちのしずく等: 味方の特性が回復より先に出て効果が届かない
      return `特性「${v.join('」「')}」を持つ味方には、この技の効果がきかない(かわりにその特性が出る)`;
    }
    return null;
  };
  const handledTypes = new Set(['dynamax_target','dynamax','not_grounded','move_class']);
  const immuneLines = (bd.immune || []).filter(im => !handledTypes.has(im.type)).map(immuneT).filter(Boolean);
  // ★2026-06-15: 既出回避を「」を除外して正規化比較(やどりぎのタネ重複対策)
  const norm = s => String(s).replace(/[「」『』]/g, '');
  const tn = norm(text);
  const newLines = immuneLines.filter(line => !tn.includes(norm(line)));
  if (newLines.length) text += newLines.join('。') + '。';
  // ★必中フラグ(bd.must_hit)を訳す(2026-06-15・Bulbapedia裏取り): 既に必中を言っている技(必中kind等)は重複させない。
  // = ふきとばし/ほえる など、必中kindを持たず bd.must_hit だけで必中を表す技の取りこぼしを補う。
  if (bd.must_hit === true && !/必ず命中|必中/.test(text)) {
    text += `相手の回避率や自分の命中率に関係なく、必ず命中する。`;
  }
  // ★まもり貫通(bd.not_blocked_by)。※音技等のnot_blocked_byは意味が違う場合があるので「強制交代(吹き飛ばし)」kind限定で訳す(ふきとばし/ほえる・Bulbapedia裏取り済)。
  if (eff.some(e => e.kind === '強制交代(吹き飛ばし)') && (bd.not_blocked_by || []).length && !/効果を受けない/.test(text)) {
    text += `相手の「${bd.not_blocked_by.join('」「')}」の効果を受けない。`;
  }
  // ★ダイウォール無効(bd.not_blocked_by の中で SYSTEM_OF=='dynamax' のもの)を後置(2026-06-17 阿部さん):
  //   未解禁=カッコ書き(つぼをつく/いやしのすず/とおぼえ/フェイント/アロマミスト/じばそうさ/なみだめ/デコレーション/いのちのしずく/コーチング/ゴーストダイブ 計11技)。
  //   解禁(SYSTEMS_IN_GAME.dynamax=true)時はカッコ無しの通常文に。既出は重複させない。
  const nbDyna = (bd.not_blocked_by || []).filter(x => SYSTEM_OF[x] === 'dynamax');
  if (nbDyna.length && !new RegExp(nbDyna.join('|')).test(text)) {
    text += SYSTEMS_IN_GAME.dynamax ? `「${nbDyna.join('」「')}」の効果も受けない。` : `（${nbDyna.join('・')}の効果も受けない）`;
  }
  // ★not_bypassing(2026-06-17 阿部さん・じばそうさ): not_blocked_by の対称形=この技は◯◯に防がれる側。
  //   ヤックンが「なお『ダイウォール』は貫通しない」と注意書きを入れる技で、似た味方支援技(いやしのすず等)が貫通技一覧に載るのと対比。
  //   未解禁=カッコ書き「(◯◯は貫通しない)」/ 解禁時はカッコ無し通常文。
  const nbpDyna = (bd.not_bypassing || []).filter(x => SYSTEM_OF[x] === 'dynamax');
  if (nbpDyna.length && !new RegExp(nbpDyna.join('|')).test(text)) {
    text += SYSTEMS_IN_GAME.dynamax ? `「${nbpDyna.join('」「')}」は貫通しない。` : `（${nbpDyna.join('・')}は貫通しない）`;
  }
  // ★みがわり貫通フラグ(substitute_pierce)を後置(2026-06-15): 効果kind「みがわり貫通」で既に喋っていなければ補う(いびき等の取りこぼし)。
  if (bd.substitute_pierce === true && !eff.some(e => e.kind === 'みがわり貫通') && !/すりぬけて当たる|みがわり.*状態でも/.test(text)) {
    // ★味方/自分だけを対象にする技(いやしのすず=party回復)は「相手の」でなく「味方の」みがわりに届く、と言う
    // ★self単独はallyOnly扱いしない(2026-06-17 阿部さん指摘・フレアソング等の音系自己強化技は legacy「相手の『みがわり』状態を貫通する」と書く)。
    //   ally扱いは party/team/ally/incoming(味方/手持ちを実際に対象にする技)に限定。
    const allyOnly = eff.length > 0 && eff.every(e => ['party', 'team', 'ally', 'incoming'].includes(e.target));
    text += allyOnly ? `味方が「みがわり」状態でも、効果がとどく。` : `相手の「みがわり」をすりぬけて当たる。`;
  }
  // ★ダイマックス相手に無効(bd.immune の dynamax_target)。★2026-06-17 阿部さん: 未解禁はカッコ書きで残す。解禁(flag true)なら通常文。
  if ((bd.immune || []).some(x => x.type === 'dynamax_target' || x.type === 'dynamax')) {
    text += SYSTEMS_IN_GAME.dynamax ? `ダイマックスしている相手には無効。` : `（ダイマックスしている相手には効かない）`;
  }
  // ★まもり系のダイマックス技/Zワザ貫通(bd.immune の move_class=max_move/gen7_z_move)。未解禁はカッコ書き(キングシールド/トーチカ)。
  if ((bd.immune || []).some(x => x.type === 'move_class' && (x.value === 'max_move' || x.value === 'gen7_z_move')) && !/ダイマックス技やZワザ/.test(text)) {
    text += SYSTEMS_IN_GAME.dynamax ? `ダイマックス技やZワザの攻撃は防げず、最大HPの${fracT(0.25)}のダメージを受ける。` : `（ダイマックス技やZワザの攻撃は防いでも最大HPの${fracT(0.25)}のダメージを受ける）`;
  }
  // ★音系の技(flags.sound)を後置(2026-06-15): 全sound技に「音系の技。」(legacyも全技に明記・横断漏れだった)。
  if (m.flags && m.flags.sound === true && !/音系の技/.test(text)) text += `音系の技。`;
  // ★2026-06-29 技分類フラグを後置(ヤックン表記に合わせる。風技/切る技/弾技/噛み技/踊り系/パンチ系/波動/こな)
  const F = m.flags || {};
  if (F.wind === true && !/風技/.test(text)) text += `風技。`;
  if (F.slash === true && !/切る技/.test(text)) text += `切る技。`;
  if (F.bullet === true && !/弾技/.test(text)) text += `弾技。`;
  if (F.bite === true && !/噛み技/.test(text)) text += `噛み技。`;
  if (F.dance === true && !/踊り/.test(text)) text += `踊り系の技。`;
  if (F.punch === true && !/パンチ系の技/.test(text)) text += `パンチ系の技。`;
  if (F.pulse === true && !/波動技/.test(text)) text += `波動技。`;
  if (F.powder === true && !/こな技/.test(text)) text += `こな技。`;
  // ★ダブルバトル向きの技(flags.double_battle_oriented)を後置(2026-06-17): おさきにどうぞ・サイドチェンジ・さきおくり等。
  if (m.flags && m.flags.double_battle_oriented === true && !/ダブルバトル/.test(text)) text += `ダブルバトルで使う技。`;
  return { text, holes };
}

module.exports = { compose, clause, map, isFullyGated }; // 確認HTML生成器など他ツールから同一エンジンを再利用(音のドリフト防止)
if (require.main === module) {
const byName = {}; for (const [k, m] of Object.entries(map)) byName[m.name] = m;
// 能力ランク変化テンプレの音合わせ用に代表技を名前で指定(各パラメータ形)
const NAMES = [
  // ★耳の確定待ち(これを並べて確認)
  'いばる', 'はらだいこ', 'ミストバースト', 'のろい', 'いのちがけ',
  // 以下は文脈(テンプレが効いてる確定済み等)
  'しめつける', 'すてみタックル', 'とおせんぼう', 'つるぎのまい', 'りゅうのまい', 'すてゼリフ', 'げんしのちから', 'てんしのキッス', 'サイコキネシス', 'こごえるかぜ', 'そらをとぶ', 'ふきとばし',
  // 急所率上昇テンプレ確認用(stages / always_crit / 他kind同居でプローブ)
  'クラブハンマー', 'こおりのいぶき', 'つじぎり', 'エアカッター', 'クロスポイズン'];
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let rows = '';
for (const nm of NAMES) {
  const m = byName[nm]; if (!m) { rows += `<tr><td>${nm} (なし)</td></tr>`; continue; }
  const { text, holes } = compose(m);
  const srcLines = ((m.battle_data || {}).effects || []).map(e => esc(JSON.stringify(e))).join('\n') || '(effectsなし)';
  rows += `<tr>
   <td class="mv">${esc(m.name)}</td>
   <td class="src">${srcLines}</td>
   <td class="gen">${esc(text) || '<span style="color:#ff7b72">(全effect未対応)</span>'}${holes.length ? `<div class="hole">⚠ 未対応kind(=構造の穴 or テンプレ未作): ${esc(holes.join('・'))}</div>` : ''}</td>
   <td class="leg">${esc(m.description_legacy || '')}</td>
   <td class="cur">${esc(m.description || '')}</td>
  </tr>`;
}
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>文章化レンダラ叩き台 vs ヤックン音</title><style>
 body{font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;margin:0;background:#0f1419;color:#e6edf3;font-size:16px}
 header{padding:12px 18px;background:#161b22;border-bottom:1px solid #30363d} h1{font-size:19px;margin:0}
 .sub{font-size:13px;color:#9aa7b4;margin-top:6px;line-height:1.7}
 table{border-collapse:collapse;width:100%} th{background:#21262d;color:#9aa7b4;font-size:14px;padding:9px;text-align:left;border-bottom:2px solid #30363d}
 td{padding:11px;border-bottom:1px solid #1c2128;vertical-align:top;line-height:1.75}
 .mv{color:#d2a8ff;font-weight:700;white-space:nowrap;font-size:16px}
 .src{color:#79c0ff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13.5px;line-height:1.7;min-width:340px;max-width:480px;white-space:pre-wrap;word-break:break-all}
 .gen{color:#7ee787;min-width:300px;font-size:16px} .leg{color:#e6edf3;min-width:300px;font-size:16px} .cur{color:#9aa7b4;min-width:220px;font-size:14px}
 .hole{color:#ffd479;font-size:11px;margin-top:5px}
 tr:hover td{background:#161b22}
</style></head><body>
<header><h1>🔊 effects → ヤックン音の一文(叩き台) を legacy と並べて聴く</h1>
<div class="sub"><b style="color:#7ee787">緑=新しく作る文(effectsから生成)</b> / <b>白=ヤックン(お手本・既にある良い文＝description_legacy)</b> / 灰=今の短い説明(description). <b>緑が白の意味と声に戻れてるか</b>を聴く。⚠=未対応kind(構造の穴 or テンプレ未作)。</div></header>
<table><thead><tr><th>技</th><th>元データ(effects=本番SSOT)</th><th>🟢 新版(これを作りたい)</th><th>★ ヤックン(お手本)</th><th>今の短い説明</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'waza_compose.html'), html);
console.log('生成: review/waza_compose.html /', NAMES.length, '技');

// 精度上げ③: 全490を compose し、生成文に機械が漏れていないか検知(回帰ガード)。※正しさは保証しない=legacyの耳のみ。
const LEAK = /[A-Za-z]{2,}|(?<![0-9])0\.[0-9]+|\btrue\b|\bundefined\b|\bNaN\b/;
let scanned = 0, leaks = [], voiced = 0;
for (const m of Object.values(map)) {
  const { text, holes } = compose(m); scanned++;
  if (text && !holes.length) voiced++;
  if (text) { const t = text.replace(/HP|PP|kg/g, ''); if (LEAK.test(t)) leaks.push(`${m.name}: ${text.slice(0, 80)}`); } // HP/PP/kg=正当な単位(機械漏れでない)
}
console.log(`\n[機械漏れ検知] 全${scanned}技中 フル生成可 ${voiced}技 / 生成文に機械漏れ ${leaks.length}件`);
leaks.slice(0, 15).forEach(x => console.log('  🔴 ' + x));
if (leaks.length === 0) console.log('  ✅ 漏れなし(生成済みテンプレ範囲)');
}
