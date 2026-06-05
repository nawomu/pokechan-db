/* condition → 子ども向け日本語フル表示(改良版 condStr)。両ビュー共通の正版。 */

// type → 日本語ラベル(語尾は『の時』前提)
const L = {
  ability: c => `特性が『${c.value}』の時`,
  ability_in: c => `特性が『${(c.values||[]).join('』『')}』の時`,
  field: c => `場が『${c.value}』の時`,
  field_is: c => `場が『${c.value}』の時`,
  field_state: c => `場が『${c.value}』状態の時`,
  field_active: c => `場がフィールドの時`,
  terrain: c => `場が『${c.value}』の時`,
  weather: c => `天気が${c.value==='なし(通常)'?'ふつう':`『${c.value}』`}の時`,
  weather_in: c => `天気が『${(c.values||[]).join('』『')}』の時`,
  grounded: c => `地面にいる時`,
  user_grounded: c => `自分が地面にいる時`,
  target_grounded: c => `相手が地面にいる時`,
  user_type: c => `自分が『${c.value}』タイプの時`,
  user_is_type: c => `自分が『${(c.values||[c.value]).join('』『')}』タイプの時`,
  user_not_type: c => `自分が『${c.value}』タイプでない時`,
  type_in: c => `『${(c.values||[]).join('』『')}』タイプの時`,
  not_type_in: c => `『${(c.values||[]).join('』『')}』タイプでない時`,
  target_type_in: c => `相手が『${(c.values||[]).join('』『')}』タイプの時`,
  target_type_not_in: c => `相手が『${(c.values||[]).join('』『')}』タイプでない時`,
  ally_type: c => `味方が『${(c.values||[]).join('』『')}』タイプの時`,
  ally_type_not: c => `味方が『${(c.values||[]).join('』『')}』タイプでない時`,
  target_has_status: c => `相手が『${c.value}』状態の時`,
  target_has_status_condition: c => `相手が状態異常の時`,
  target_status_in: c => `相手が『${(c.values||[]).join('』『')}』状態の時`,
  user_status_in: c => `自分が『${(c.values||[]).join('』『')}』状態の時`,
  holds_item: c => `『${c.value}』を持っている時`,
  holding_item: c => `『${c.value}』を持っている時`,
  target_holding_item: c => `相手が道具を持っている時`,
  user_has_no_held_item: c => `自分が道具を持っていない時`,
  target_holds_battle_effect_berry: c => `相手がバトルで効果のある『きのみ』を持っている時`,
  target_used: c => `相手が『${c.value}』を使っている時`,
  target_used_move: c => `相手が『${c.value}』を使っている時`,
  target_used_minimize: c => `相手が『ちいさくなる』を使っている時`,
  target_minimized: c => `相手が『ちいさくなる』を使っている時`,
  user_moves_after_target: c => `自分が後攻の時`,
  target_already_damaged_this_turn: c => `相手がそのターンすでにダメージを受けている時`,
  user_took_damage_this_turn: c => `そのターン自分が攻撃のダメージを受けた時`,
  target_stat_rose_this_turn: c => `そのターンに相手の能力ランクが上がった時`,
  target_stat_raised_this_turn: c => `そのターンに相手の能力ランクが上がった時`,
  user_stat_lowered_this_turn: c => `そのターンに自分の能力ランクが下げられた時`,
  not_first_round_user_this_turn: c => `同じターンで自分より先に同じ技が使われた時`,
  previous_turn_move_failed_or_could_not_act: c => `前のターンで技が外れた・失敗した・行動できなかった時`,
  failed_to_act_last_turn: c => `前のターンで技が外れた・失敗した・行動できなかった時`,
  contact_move: c => `接触技(直接攻撃)で攻撃された時`,
  hit_by_contact_move_while_protecting: c => `守っている間に接触技で攻撃された時`,
  hit_by_contact_move_before_activation: c => `技が出る前に接触技で攻撃された時`,
  opposite_gender: c => `相手が自分と違う性別の時`,
  stockpile_count: c => `『たくわえる』を使った数が${c.value}つの時`,
  target_knocked_out_by_this_move: c => `この技で相手を倒した時`,
  used_before_target_moves: c => `相手が技を出す前に使った時`,
  target_is_ally: c => `味方に使った時`,
  user_species: c => `自分が『${c.value}』の時`,
  user_species_form: c => `自分が『${c.value}』の時`,
};
// ネストの文字列トークン
const TOK = { user_is_flying_type: '自分がひこうタイプ', 'user_ability_ふゆう': '特性ふゆう' };

// 除外対象のリストを正規化(["ひこうタイプ","特性ふゆう"] の形に揃える)
function exParts(c) {
  let parts = [];
  const push = (arr, bareType) => arr && arr.forEach(x => {
    x = TOK[x] || x;
    if (x === 'ふゆう') x = '特性ふゆう';                         // 素の特性名 → 「特性」を補う
    else if (bareType && !/タイプ$/.test(x)) x += 'タイプ';        // excludes_types は素のタイプ名 → 「タイプ」補う
    parts.push(x);
  });
  push(c.grounded_exceptions, false);
  push(c.not_negated_by, false);
  push(c.excludes_types, true);
  (c.excludes_abilities || []).forEach(x => parts.push('特性' + x));
  return parts;
}
// 「(自分が、ひこうタイプ、特性ふゆうの場合は除く)」を作る(主語: 自分が/相手が/無し)
function exNote(parts, subject) {
  if (!parts.length) return '';
  // 除外リストは不完全(ふうせん/でんじふゆう等でも浮く)→「など」を残し説明文に忠実に
  return `(${subject}${subject ? '、' : ''}${parts.join('、')}などの場合は除く)`;
}

function condStrNew(c) {
  if (typeof c !== 'object' || !c) return String(c);
  if (c.type === 'any_of') {
    const vs = (c.values||[]).map(v => typeof v==='object' ? condStrNew(v) : (TOK[v]||v));
    return `次のどれかの時: ${vs.join(' または ')}`;
  }
  if (c.type === 'all') {
    const vs = (c.values||[]).map(v => typeof v==='object' ? condStrNew(v) : (TOK[v]||v));
    return vs.join(' かつ ');
  }
  const f = L[c.type];
  let base = f ? f(c) : `【未対応:${c.type}】`;
  const parts = exParts(c);
  const isGrounded = c.type === 'grounded' || c.type === 'user_grounded' || c.type === 'target_grounded';
  // ① 場/フィールド等に and:user_grounded が併記 → 「場が『X』の時(自分が、…の場合は除く)」(地面にいる表現は出さない)
  if (c.and === 'user_grounded') {
    base += parts.length ? exNote(parts, '自分が') : 'で、自分が地面にいる時';
  }
  // ② 接地系 type 自身: 除外があれば「(主語、…の場合は除く)」だけにし、地面にいる表現は省く。無ければアンカーとして残す
  else if (isGrounded) {
    const subj = c.type === 'user_grounded' ? '自分が' : c.type === 'target_grounded' ? '相手が' : '';
    if (parts.length) base = exNote(parts, subj);   // 例: (ひこうタイプ、特性ふゆうの場合は除く)
    // 除外なし(グラスフィールドの分割effect等)は base のまま=「自分が地面にいる時」をアンカーで残す
  }
  if (c.needs_research || c.complete === false) base += ` ⚠️要調査`;
  return base;
}

module.exports = { L, TOK, exParts, exNote, condStrNew };
