/* 叩き台: effects(SSOT) → ヤックン音の一文を「生成」するレンダラ試作。
 * 生成文を description_legacy(音の見本)/description と並べて検証。未対応kindは(未対応)で穴を可視化。
 * 実行: node tools/_waza_compose.js  → review/waza_compose.html */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { condStrNew } = require('./_cond_render.js');
function lit(t, m) { const at = t.indexOf(m); let i = t.indexOf('{', at), s = i, d = 0, S = false, e = false; for (; i < t.length; i++) { const c = t[i]; if (S) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') S = false; } else { if (c === '"') S = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return t.slice(s, i + 1); } } } }
const map = JSON.parse(lit(fs.readFileSync(path.join(ROOT, 'pokechan_data.js'), 'utf8'), 'const WAZA_MAP ='));

// ✓声ルール(台帳): 0.5→半分 / 1→全部 / それ以外→1/N スラッシュ表記(8分の1化しない)
const fracT = f => { if (f == null || isNaN(f)) return ''; if (Math.abs(f - 1) < 0.001) return '全部'; if (Math.abs(f - 0.5) < 0.001) return '半分'; const r = Math.round(1 / f); return Math.abs(1 / f - r) < 0.04 ? `1/${r}` : (+(f * 100).toFixed(1)) + '%'; };
const multT = mu => mu >= 1 ? `${mu}倍になる` : (Math.abs(mu - 0.5) < 0.001 ? '半分になる' : `${fracT(mu)}になる`);
const durT = d => Array.isArray(d) ? `${d[0]}〜${d[1]}ターン` : (typeof d === 'number' ? `${d}ターン` : ({ until_user_leaves: '自分が場を離れるまで', until_removed: '消えるまで' }[d] || d));
const TGT = { self: '自分', opponent: '相手', team: '味方', all: '場の全員', ally: '味方', all_opponents: '相手全体', all_but_self: '自分以外', party: '手持ち全員', incoming: '次に出る味方' };
const TGT2 = { self: '自分の', opponent: '相手の', all_opponents: '相手全員の', ally: '味方の', team: '味方全員の', all: '場の全員の', all_but_self: '自分いがいの全員の', party: '手持ちの', incoming: '次に出る味方の' };
// 能力名: こうげき系はlegacy同様ひらがな / 命中率・回避率はlegacyが漢字(ひらがな0件)→漢字。
const STAT = { attack: 'こうげき', defense: 'ぼうぎょ', special_attack: 'とくこう', special_defense: 'とくぼう', speed: 'すばやさ', accuracy: '命中率', evasion: '回避率', all: 'すべての能力' };
const statList = e => (Array.isArray(e.stats) ? e.stats : [e.stat]).map(s => STAT[s] || s);
const joinStats = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a.join('と') : a.join('・');
const immT = arr => (arr || []).map(x => x.value || (x.values || []).join('・')).join('・');
// condStrNew は「〜の時/〜の場合」を返す。文頭につなぐ。
const condT = c => condStrNew(c).replace(/の時$/, 'のとき').replace(/の場合は除く\)/, 'はのぞく)').replace(/『/g, '「').replace(/』/g, '」'); // 囲みは「」に統一(共有_cond_renderは触らずcompose側で吸収)

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
      if (e.value === 'バインド') {
        let s = `相手をバインド状態にして、${durT(e.duration)}の間、毎ターン終わりに、最大HPの${fracT(e.turn_end_damage)}だけダメージを与える`;
        if (e.prevents_switch) s += `。その間、${immT(e.immune)}タイプでない相手は、逃げたり交代したりできない`;
        return s;
      }
      const pp = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : ''; // 忠実: 確率はデータのまま。落とすと「必ず◯」化(意味漏れ)
      if (e.value === 'ひるみ') return `${pp}相手をひるませる`; // ひるみは動作=「ひるませる」(『ひるみ』状態にする は不自然・kind:ひるみ と統一)
      const dd = e.duration ? `${durT(e.duration)}の間、` : '';
      return `${pp}${dd}${t}を「${e.value}」状態にする`; // 囲みは「」(2026-06-07 阿部さん・ヤックン『』と差別化)
    }
    case '拘束':
      return `${immT(e.immune)}タイプでない相手を、${durT(e.duration)}の間、逃げたり交代したりできないようにする`;
    case 'まもり貫通':
      // ★bypasses形(ゴーストダイブ/なみだめ): 相手の守り技リストの効果を受けない。not_bypassed=除外。
      if (Array.isArray(e.bypasses)) {
        const ex = (e.not_bypassed || []).length ? `(「${e.not_bypassed.join('」「')}」は除く)` : '';
        return `相手の「${e.bypasses.join('」「')}」の効果を受けない${ex}`;
      }
      // フェイント形: まもる等を貫通して当たる(一部除く)
      if (Array.isArray(e.pierces_without_removing)) {
        const ex = `(「${e.pierces_without_removing.join('」「')}」は除く)`;
        return `相手が「まもる」などで守っていても、それを無視して当たる${ex}`;
      }
      // ニードルガード形(守り側): ダイマックス技/Zワザで攻撃されてもダメージを軽くする
      if (Array.isArray(e.values) && e.user_takes_fraction != null) {
        return `「${e.values.join('」「')}」で攻撃されても、受けるダメージを最大HPの${fracT(e.user_takes_fraction)}までにおさえる`;
      }
      return null;
    case '反動':
      return `相手に与えたダメージの${fracT(e.fraction)}を、自分も受ける`;
    case '威力倍率':
      return `威力が${multT(e.multiplier)}`;
    case '自分瀕死':
      return `技を使ったあと、自分はひんしになる`;
    case '回復':
      return `${t}のHPを、最大HPの${fracT(e.fraction)}だけ回復する`;
    case 'HPが減る':
      return `自分のHPが最大HPの${fracT(e.fraction)}減る`;
    case '固定ダメージ':
      return `相手に、${amountT(e.amount)}のダメージを与える(タイプ相性は受けない)`;
    case '継続削り':
      return `毎ターン、相手のHPを最大HPの${fracT(e.fraction)}だけ削る`;
    case '連続攻撃':
      if (e.hits_by) return `手持ちのポケモンの数だけ攻撃する`;
      if (e.stop_on_miss) return `外れるまで最大${e.max_hits}回攻撃する`;
      if (e.hits) return `${e.hits}回攻撃する`;
      if (e.min_hits) return `${e.min_hits}〜${e.max_hits}回攻撃する`;
      return null;
    case '急所率上昇':
      // ★±N表記(2026-06-07 阿部さん上書き): 「急所+1」(「ランク」語は省く・短く=能力ランク±Nと揃える)。always_crit→「必ず急所に当たる」。
      if (e.always_crit) return `必ず急所に当たる`;
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
      return null; // needs_research 等は穴
    }
    case '能力ランク変化': {
      if (e.reset) return `場にいる全員の能力ランクの変化を、すべて元にもどす`; // くろいきり
      if (!e.stat && !e.stats) return null;
      const sts = statList(e);
      const pre = (e.prob && e.prob < 100) ? `${e.prob}%の確率で` : '';
      const who = TGT2[e.target] || (t + 'の');
      // ★±N表記に統一(2026-06-07 阿部さん): 能力ランクの増減は「こうげき-1、とくこう-1」。✗「〜が1段階さがる」。
      // 各能力に符号つき数値を付ける(同stagesでも能力ごとに繰り返す)。to_maxのみ特例(数値でない)。
      if (e.to_max) return `${pre}${who}${joinStats(sts)}が最大まであがる`;
      const sg = e.stages > 0 ? `+${e.stages}` : `${e.stages}`; // 負はそのまま(-2 など)
      return `${pre}${who}${sts.map(s => `${s}${sg}`).join('、')}`;
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
      if (Array.isArray(e.value)) return `相手の「${e.value.join('」「')}」の状態を解除する`;
      const who = e.target === 'team' ? '味方みんな' : e.target === 'self' ? '自分' : (TGT[e.target] || '自分');
      return `${who}の状態異常をすべて治す`;
    }
    case '吸収':
      return `相手に与えたダメージの${fracT(e.fraction)}だけ、自分のHPを回復する`;
    case '自分交代':
      return (Array.isArray(e.pass) && e.pass.length)
        ? `自分の能力の変化などを引きついで、控えのポケモンと交代する`
        : `攻撃したあと、控えのポケモンと交代する`;
    case 'みがわり貫通':
      return `相手の「みがわり」をすりぬけて当たる`;
    case '半無敵命中': {
      const M = { '水中': 'ダイビング', '地中': 'あなをほる', '空中': 'そらをとぶ・とびはねる' };
      const states = e.hits_state || [];
      const moves = states.map(s => M[s] || s).join('」「');
      let s = `相手が「${moves}」で${states.join('・')}にいる時でも当てられる`;
      if (e.damage_multiplier && e.damage_multiplier !== 1) s += `。そのときダメージが${e.damage_multiplier}倍になる`;
      return s;
    }
    case '次のターン行動不能':
      return `使った次のターンは、動けなくなる`;
    case 'まもり':
      return `そのターン、相手の技をふせぐ。続けて使うと失敗しやすくなる`;
    case 'こらえる':
      return `そのターン、どんな攻撃を受けてもHPが1だけ残ってたえる。続けて使うと失敗しやすくなる`;
    case '範囲まもり':
      return `そのターン、複数を巻きこむ技から自分と味方をまもる`;
    case 'まもり解除':
      return `相手の「まもる」などの守りをやぶってから攻撃する`;
    case '設置': {
      const v = e.value;
      // 交代で出てくるたびのダメージ量を層数ごとに出す(legacyに明記=戻すべき細部)
      const dmgT = () => {
        const d = e.damage_on_switch_in;
        if (!Array.isArray(d) || !d.length) return '';
        if (d.length === 1) return `(最大HPの${fracT(d[0].fraction)})`;
        return `(${d.map(x => `${x.layers}回で${fracT(x.fraction)}`).join('・')})`;
      };
      if (v === 'ステルスロック') return `相手の場に とがった岩をうかべる。相手が交代で出てくるたびに、最大HPの${fracT(0.125)}ぶんダメージを与える(いわが弱点のタイプほど大きく、効きにくいタイプほど小さくなる)`;
      if (v === 'まきびし') return `相手の場に まきびしをまく(最大${e.max_layers || 3}回まで重ねられる)。相手が交代で出てくるたびにダメージを与える${dmgT()}(地面にいない相手には効かない)`;
      if (v === 'どくびし') return `相手の場に どくびしをまく。相手が交代で出てくると どく状態になる(2回重ねると もうどく。地面にいない相手には効かない)`;
      if (v === 'ねばねばネット' || v === 'sticky_web') return `相手の場に ねばねばネットをはる。相手が交代で出てくると すばやさが1段階下がる(地面にいない相手には効かない)`;
      return /^[A-Za-z_]+$/.test(String(v || '')) ? `相手の場に わなをしかける` : `相手の場に「${v}」をしかける`;
    }
    case '設置除去':
      return `自分の場の「${(e.values || []).join('」「')}」を消す`;
    case '壁設置': {
      const r = e.reduces || [];
      const what = (r.includes('special_damage') && r.includes('physical_damage')) ? '物理技と特殊技'
        : r.includes('special_damage') ? '特殊技' : r.includes('physical_damage') ? '物理技' : '技';
      let s = `${durT(e.duration)}の間、味方が受ける${what}のダメージを${fracT(e.multiplier)}にする(急所には効かない)`;
      if (e.persists_through_switch) s += '。交代しても消えない';
      return s;
    }
    case '壁除去':
      return `相手の「${(e.values || []).join('」「')}」をこわしてから攻撃する`;
    case '天候変化':
      return `${durT(e.duration)}の間、天気を「${e.value}」にする`;
    case '天候必中':
      if (Array.isArray(e.cases)) {
        const parts = e.cases.map(c => (c.accuracy === '必中' || c.accuracy === 'never_miss')
          ? `「${c.weather}」のときは必ず当たる` : `「${c.weather}」のときは命中率が${c.accuracy}%になる`);
        return parts.join('。');
      }
      return (e.accuracy === 'never_miss' || e.accuracy === '必中') ? `天気が「${e.value}」のときは必ず当たる` : null;
    case '場の威力補正': {
      // ばくれつパンチ(特性条件) / グラスフィールド(タイプ・地面条件で威力上下)
      const mt = e.move_type ? `「${e.move_type}」タイプの技の` : '';
      const dir = e.multiplier >= 1 ? '高くなる' : '下がる';
      if (e.moves) return `${e.moves.map(x => `「${x}」`).join('')}の威力が${multT(e.multiplier)}`;
      return `${mt}威力が${dir}(${multT(e.multiplier)})`;
    }
    case '引き寄せ':
      return `そのターン、相手の技を自分に引き寄せる`;
    case 'フィールド展開':
      return `${durT(e.duration)}の間、足元を「${e.value}」にする`;
    case 'フィールド除去':
      return `場のフィールドを消す`;
    case '一撃必殺':
      return `当たれば相手は 一発でひんしになる`;
    case '暴れる(混乱)':
      return `${durT(e.duration)}の間、同じ技を出しつづける(ほかの行動はできない)`;
    case '連続強制(混乱なし)':
      return `${durT(e.duration)}の間、同じ技を出しつづける`;
    case '倍返し': {
      const cat = (e.basis || '').includes('physical') ? '物理技' : (e.category === '特殊' || (e.basis || '').includes('special')) ? '特殊技' : '技';
      return `先に相手の${cat}を受けてから、そのダメージの${e.multiplier || 2}倍を返す(タイプ相性は関係なく当たる)`;
    }
    case '特性上書き':
      if (e.source === 'opponent_ability') return `相手の特性を、自分の特性としてコピーする`;
      if (e.value) return `相手の特性を「${e.value}」に変える`;
      return `相手の特性を 上書きする`;
    case '特性交換':
      return `自分と相手の特性を入れかえる`;
    case '特性無効化':
      return `相手の特性を、場にいる間きかなくする`;
    case '技タイプ変更':
      if (e.mapping) {
        const ex = Object.entries(e.mapping).map(([k, v]) => `「${k}」なら${v}`).join('・');
        return `天気によって技のタイプが変わる(${ex}。天気がなければ${e.default_type || 'ノーマル'})`;
      }
      if (e.type_by_form) {
        const ex = Object.entries(e.type_by_form).map(([k, v]) => `「${k}」のときは${v}`).join('・');
        return `すがたによって技のタイプが変わる(${ex})`;
      }
      if (Array.isArray(e.values)) return `すがたによって技のタイプが「${e.values.join('」「')}」に変わる`;
      return null;
    case 'タイプ上書き':
      // ミラータイプ等は value が機械値(copy_target_current_types)→意味で訳す
      if (e.value === 'copy_target_current_types') return `自分のタイプを、相手と同じタイプに変える`;
      return /^[A-Za-z_]+$/.test(String(e.value || '')) ? `相手のタイプを変える` : `相手のタイプを「${e.value}」だけに変える`;
    case 'タイプ追加':
      return `相手に「${e.value}」タイプを追加する`;
    case 'タイプ除去':
      return `自分の「${e.value}」タイプがなくなる`;
    case 'タイプ一時無効':
      return `そのターンだけ、自分の「${e.value}」タイプがなくなる`;
    case '技タイプ追加':
      return `この技は「${e.value}」タイプも合わさったあつかいになる`;
    case '失敗ダメージ':
      return `外れると、自分が最大HPの${fracT(e.fraction)}ぶんダメージを受ける`;
    case '状態異常予防':
      return e.value === 'ねむり' ? `${durT(e.duration)}の間、場のどのポケモンも ねむれなくなる` : `${durT(e.duration)}の間、状態異常をふせぐ`;
    case '条件威力倍率':
      return `威力が${multT(e.multiplier)}`;
    case '威力段階増加':
      return `ひんしになった味方の数が多いほど威力が高くなる(1体ごとに+${e.power_increment})`;
    case 'ランク数威力加算':
      return `自分の能力ランクが上がっているほど威力が高くなる(1段階ごとに+${e.add_per_stage})`;
    case '強制交代(吹き飛ばし)':
      return `相手をむりやり交代させる(出てくる相手はランダム)`;
    case '強制交代(攻撃)':
      return `攻撃して、相手をむりやり交代させる(出てくる相手はランダム)`;
    case '持ち物奪取':
      return `相手の持ち物をうばう(自分が何も持っていないときだけ)`;
    case '持ち物排除':
      return `相手の持ち物をはたき落として、使えなくする`;
    case '持ち物交換':
      return `自分と相手の持ち物を入れかえる`;
    case '持ち物復活':
      return `なくなった自分の持ち物を1回だけ元にもどす`;
    case 'PP減少':
      return e.value != null ? `相手が最後に使った技のPPを${e.value}へらす` : `相手が最後に使った技のPPを大きくへらす`;
    case '部屋系':
      return `${durT(e.duration)}の間、場の全員の「ぼうぎょ」と「とくぼう」が入れかわる(もう一度使うと元にもどる)`;
    case 'トリックルーム':
      return `${durT(e.duration)}の間、すばやさが低いポケモンから先に行動する(もう一度使うと元にもどる)`;
    case 'じゅうりょく':
      return `${durT(e.duration)}の間、みんなの命中率が上がり、浮いているポケモンも地面にいるあつかいになる。空をとぶ技は使えなくなる`;
    case '必ず急所':
      return `必ず急所に当たる`;
    case 'ランク無視':
      return `相手の能力ランクの変化を無視して攻撃する`;
    case 'ランクリセット':
      return `相手の能力ランクの変化をすべて元にもどす`;
    case 'ランクコピー':
      return `相手の能力ランクの変化を、自分にコピーする`;
    case '別防御参照ダメージ':
      return `特殊技だが、相手の「ぼうぎょ」でダメージを計算する`;
    case '別能力ダメージ':
      return `自分の「ぼうぎょ」の高さでダメージを計算する`;
    case '相手能力ダメージ':
      return `相手の「こうげき」の高さでダメージを計算する(相手が強いほど痛い)`;
    case '物理特殊自動':
      return `物理と特殊のうち、ダメージが大きいほうで攻撃する`;
    case '相手持ち物威力':
      return `相手の持ち物を使って攻撃する。相手が持ち物を持っていないと失敗する`;
    case '相性上書き':
      return `「${e.against_type}」タイプの相手に こうかばつぐんになる`;
    case 'やどりぎ':
      return `相手に タネをうえつける。毎ターン相手のHPを最大HPの${fracT(e.fraction)}吸い取って、自分のHPを回復する(くさタイプには効かない)`;
    case 'みちづれ':
      return `自分が次に行動する前に相手の技でひんしになると、その相手も道づれにする`;
    case 'ほろびのうた':
      return `使った時に場にいた全員が、${e.duration || 3}ターン後にひんしになる(交代するとのがれられる)`;
    case 'ロックオン':
      return `次にこの相手へ使う技が、必ず当たるようになる`;
    case 'メロメロ付与':
      return `相手を メロメロにする(異性にだけ効く)。メロメロの相手は50%の確率で動けなくなる`;
    case 'アンコール':
      return `${durT(e.duration)}の間、相手は直前に使った技しか出せなくなる`;
    case 'ちょうはつ':
      return `${durT(e.duration)}の間、相手は変化技を出せなくなる`;
    case 'いちゃもん':
      return `相手は同じ技を続けて出せなくなる`;
    case 'かなしばり':
      return `相手が最後に使った技を、${durT(e.duration)}の間 出せなくする`;
    case 'ふういん':
      return `自分も知っている技を、相手は使えなくなる`;
    case 'カテゴリ封じ':
      return `${durT(e.duration)}の間、相手は音の技を出せなくなる`;
    case '全員逃走不可':
      return `${durT(e.duration)}の間、おたがい逃げたり交代したりできなくなる(ゴーストタイプはのぞく)`;
    case '拘束解除':
      return `自分にかかったバインドなどの状態をふりほどく`;
    case '自分拘束':
      return `地面に根をはる。逃げられなくなるが、毎ターン少しずつHPが回復する`;
    case 'いたみわけ':
      return `自分と相手の今のHPを合わせて、半分ずつに分ける`;
    case '実数値折半':
      return `自分と相手の${joinStats(statList(e))}の数値を合わせて、半分ずつにする`;
    case 'たくわえ加算':
      return `「たくわえ」を1つためる(最大${e.max || 3}つ)。ぼうぎょ・とくぼうも上がる`;
    case 'たくわえ消費':
      return `ためた「たくわえ」を使いきって、上がっていたぼうぎょ・とくぼうを元にもどす`;
    case '能力入替': {
      const sts = statList(e);
      // パワートリック=自分の中で入替 / スワップ系=相手とランク入替
      if (e.target === 'self' && !e.effect && !e.detail) return `自分の${joinStats(sts)}の数値を入れかえる`;
      return `自分と相手の${joinStats(sts)}のランクの変化を入れかえる`;
    }
    case '能力ランク変化_リセット': // 予備
    case '直後に行動':
      return `この技を使ったあと、相手はすぐ次に行動する`;
    case '最後に行動':
      return `そのターン、相手の行動を一番最後にする`;
    case '相手技タイプ変更':
      return `相手より先に使うと、相手のその技を「${e.value}」タイプに変える`;
    case '木の実強制':
      return `相手の持っているきのみをうばって、その場で自分が食べる`;
    case '木の実奪取食':
      return `相手の持っているきのみをうばって、自分で食べる`;
    case 'やけど低下無視':
      return `やけどでこうげきが下がっていても、下がっていないあつかいで攻撃する`;
    case '次技威力倍化':
      return `次に出す「${e.move_type}」タイプの技の威力が${e.multiplier}倍になる`;
    case '味方威力上昇':
      return `そのターン、味方の技の威力が${multT(e.multiplier)}`;
    case '命中率固定':
      return `命中率が${e.value}%になる`;
    case 'ランダム技':
      return `自分が覚えている技の中から、ランダムで1つ出す`;
    case '直前技模倣':
      return `直前にだれかが使った技を、自分も出す`;
    case '技強制再使用':
      return `相手に、直前に使った技をもう一度すぐ出させる`;
    case '遅延攻撃':
      return `${e.delay_turns || 2}ターン後に、その場所にいる相手へ攻撃が当たる`;
    case '接触反動':
      return `この守りが成功して相手が直接攻撃してくると、相手は最大HPの${fracT(e.fraction)}ダメージを受ける`;
    case '優先技無効':
      return `${durT(e.duration)}の間、地面にいるポケモンは相手の先制技を受けなくなる`;
    case '次ターン使用不可':
      return `この技は2ターン続けて出せない`;
    case 'みがわり設置':
      return `自分のHPを最大HPの${fracT(0.25)}使って、みがわりを作る。みがわりがある間は攻撃を肩がわりしてくれる`;
    case 'へんしん':
      return `相手のすがた・能力・覚えている技をコピーして、相手とそっくりになる`;
    case 'なげつける':
      return `持っている道具を投げつけて攻撃する。道具によって威力や効果が変わる`;
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
      return `サイコフィールドで自分が地面にいると、相手全体に当たるようになる`;
    case '条件付き優先':
      // 自己完結文(条件込み)。compose側はこのkindがある時 priority行を出さない+ゴミ条件文も前置しない
      return e.priority ? `グラスフィールドで自分が地面にいると、優先度+${e.priority}で先に攻撃できる(ふだんは優先度0)` : null;
    case '行動順繰上げ':
      return `そのターン、味方の行動順を自分のすぐ後ろにする`;
    case '位置入替':
      return `自分と味方の立ち位置を入れかえる`;
  }
}
function compose(m) {
  const eff = (m.battle_data && m.battle_data.effects) || [];
  const holes = [], groups = [];
  for (const e of eff) {
    // ★溜めターン発動の能力上昇は「2ターン目に攻撃」の文に織り込み済→単独では出さない(二重防止)。
    if (e.kind === '能力ランク変化' && e.on_charge_turn && eff.some(x => x.kind === '2ターン目に攻撃')) continue;
    const c = clause(e, m); if (!c) { holes.push(e.kind); continue; }
    const key = e.condition ? JSON.stringify(e.condition) : '';
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, cond: e.condition, cl: [] }; groups.push(g); }
    g.cl.push({ text: c, kind: e.kind });
  }
  const sentences = groups.map(g => {
    const body = g.cl.map((cl, i) =>
      (i > 0 && cl.kind === '能力ランク変化' && g.cl[i - 1].kind === 'HPが減る') ? 'そのかわり、' + cl.text : cl.text
    ).join('。');
    // 条件文がゴミ(⚠️要調査=condStrNewが訳しきれない複雑条件)なら前置しない=clauseが自己完結で意味を持つ
    const ct = g.cond ? condT(g.cond) : '';
    return (ct && !ct.includes('⚠')) ? `${ct}、${body}` : body;
  });
  let text = sentences.length ? sentences.join('。') + '。' : '';
  const bd = m.battle_data || {};
  // ★優先度を説明に入れる(2026-06-07 阿部さん): battle_data.priority(構造)から。
  // ただし「条件付き優先」kind(グラススライダー等)がある時は二重になるので出さない(clauseが条件込みで喋る)。
  const pr = bd.priority;
  const hasCondPrio = eff.some(e => e.kind === '条件付き優先');
  if (typeof pr === 'number' && pr !== 0 && !hasCondPrio) {
    text = (pr > 0 ? `優先度+${pr}で、先に攻撃できる。` : `優先度${pr}で、必ず後攻になる。`) + text;
  }
  const lo = (bd.fails_if || []).find(f => f.type === 'current_hp_below_fraction');
  if (lo) text += `(今のHPが最大HPの${fracT(lo.fraction)}より少ないと失敗する)`;
  const gi = (bd.immune || []).find(x => x.type === 'target_type' && (x.value === 'ゴースト' || (x.values || []).includes('ゴースト')));
  if (gi) text += `(ゴーストタイプには当たらない)`;
  return { text, holes };
}

module.exports = { compose, clause, map }; // 確認HTML生成器など他ツールから同一エンジンを再利用(音のドリフト防止)
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
