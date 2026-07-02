// Idempotently merge the `ability` UI namespace into all 9 ui-*.json files.
// Run: node tools/_merge_ability_ui_keys.js
const fs = require('fs');
const path = require('path');
const I18N = path.join(__dirname, '..', 'i18n');

const ABILITY = {
  ja: {
    nav_list: '🧬 特性リスト',
    search_ph: '🔍 特性名・効果で絞り込み',
    col_name: '特性名',
    col_effect: '効果',
    col_pokemon: '所持ポケモン',
    count_total: '全{n}特性',
    count_filtered: '{n}件 / 全{total}件',
    btn_reset: '🔄 リセット',
    modal_title: 'この特性を持つポケモン',
    modal_none: 'この特性を持つポケモンはいません',
    no_desc: '（説明未登録）',
    result_zero: '該当する特性がありません',
  },
  en: {
    nav_list: '🧬 Abilities',
    search_ph: '🔍 Filter by ability name or effect',
    col_name: 'Ability',
    col_effect: 'Effect',
    col_pokemon: 'Pokémon',
    count_total: 'All {n} abilities',
    count_filtered: '{n} of {total}',
    btn_reset: '🔄 Reset',
    modal_title: 'Pokémon with this ability',
    modal_none: 'No Pokémon have this ability.',
    no_desc: '(no description)',
    result_zero: 'No matching abilities.',
  },
  es: {
    nav_list: '🧬 Habilidades',
    search_ph: '🔍 Filtrar por nombre de habilidad o efecto',
    col_name: 'Habilidad',
    col_effect: 'Efecto',
    col_pokemon: 'Pokémon',
    count_total: 'Las {n} habilidades',
    count_filtered: '{n} de {total}',
    btn_reset: '🔄 Restablecer',
    modal_title: 'Pokémon con esta habilidad',
    modal_none: 'Ningún Pokémon tiene esta habilidad.',
    no_desc: '(sin descripción)',
    result_zero: 'Sin resultados.',
  },
  fr: {
    nav_list: '🧬 Talents',
    search_ph: '🔍 Filtrer par nom de talent ou effet',
    col_name: 'Talent',
    col_effect: 'Effet',
    col_pokemon: 'Pokémon',
    count_total: 'Les {n} talents',
    count_filtered: '{n} sur {total}',
    btn_reset: '🔄 Réinitialiser',
    modal_title: 'Pokémon avec ce talent',
    modal_none: "Aucun Pokémon n'a ce talent.",
    no_desc: '(aucune description)',
    result_zero: 'Aucun talent correspondant.',
  },
  de: {
    nav_list: '🧬 Fähigkeiten',
    search_ph: '🔍 Nach Fähigkeitsname oder Effekt filtern',
    col_name: 'Fähigkeit',
    col_effect: 'Effekt',
    col_pokemon: 'Pokémon',
    count_total: 'Alle {n} Fähigkeiten',
    count_filtered: '{n} von {total}',
    btn_reset: '🔄 Zurücksetzen',
    modal_title: 'Pokémon mit dieser Fähigkeit',
    modal_none: 'Kein Pokémon hat diese Fähigkeit.',
    no_desc: '(keine Beschreibung)',
    result_zero: 'Keine passenden Fähigkeiten.',
  },
  it: {
    nav_list: '🧬 Abilità',
    search_ph: '🔍 Filtra per nome abilità o effetto',
    col_name: 'Abilità',
    col_effect: 'Effetto',
    col_pokemon: 'Pokémon',
    count_total: 'Tutte le {n} abilità',
    count_filtered: '{n} di {total}',
    btn_reset: '🔄 Reimposta',
    modal_title: 'Pokémon con questa abilità',
    modal_none: 'Nessun Pokémon ha questa abilità.',
    no_desc: '(nessuna descrizione)',
    result_zero: 'Nessuna abilità corrispondente.',
  },
  ko: {
    nav_list: '🧬 특성',
    search_ph: '🔍 특성 이름이나 효과로 검색',
    col_name: '특성',
    col_effect: '효과',
    col_pokemon: '포켓몬',
    count_total: '전체 {n}개 특성',
    count_filtered: '{n} / {total}건',
    btn_reset: '🔄 초기화',
    modal_title: '이 특성을 가진 포켓몬',
    modal_none: '이 특성을 가진 포켓몬이 없습니다.',
    no_desc: '(설명 없음)',
    result_zero: '해당하는 특성이 없습니다.',
  },
  'zh-Hans': {
    nav_list: '🧬 特性',
    search_ph: '🔍 按特性名或效果筛选',
    col_name: '特性',
    col_effect: '效果',
    col_pokemon: '宝可梦',
    count_total: '全部 {n} 个特性',
    count_filtered: '{n} / {total}',
    btn_reset: '🔄 重置',
    modal_title: '拥有该特性的宝可梦',
    modal_none: '没有宝可梦拥有该特性。',
    no_desc: '（暂无说明）',
    result_zero: '没有匹配的特性。',
  },
  'zh-Hant': {
    nav_list: '🧬 特性',
    search_ph: '🔍 依特性名稱或效果篩選',
    col_name: '特性',
    col_effect: '效果',
    col_pokemon: '寶可夢',
    count_total: '全部 {n} 個特性',
    count_filtered: '{n} / {total}',
    btn_reset: '🔄 重設',
    modal_title: '擁有該特性的寶可夢',
    modal_none: '沒有寶可夢擁有該特性。',
    no_desc: '（暫無說明）',
    result_zero: '沒有符合的特性。',
  },
};

const langs = ['ja', 'en', 'es', 'fr', 'de', 'it', 'ko', 'zh-Hans', 'zh-Hant'];
let changed = 0;
for (const lang of langs) {
  const file = path.join(I18N, `ui-${lang}.json`);
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(obj.ability);
  obj.ability = ABILITY[lang];
  const after = JSON.stringify(obj.ability);
  if (before !== after) {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    changed++;
    console.log(`updated ui-${lang}.json`);
  } else {
    console.log(`unchanged ui-${lang}.json`);
  }
}
console.log(`done. ${changed} file(s) changed.`);
