#!/usr/bin/env node
/* claude-design→glm-impl 依頼: 全国版セクション+特性ページのi18n 9言語配線
 * 追加12キー(ability 2 + index 10) を ui-*.json 9ファイルへ追記。
 * 仕様書=reference/_i18n_national_spec.md
 * 用語統一: 既存 ui-*.json + move_tags_i18n.json + content-ui.json の訳を流用(でっち上げ禁止)。
 *   Pokémon Champions: ko=포켓몬 챔피언스 / zh-Hans=宝可梦冠军赛 / zh-Hant=寶可夢冠軍賽 / 他=原語
 *   先制=priority: en Priority/fr Priorité/de Priorität/es Prioridad/it Priorità/ko 선제・우선도/zh 先制
 *   斬る=slicing: en slicing/fr tranchante/de Schnitt/es cortante/it tagliente/ko 슬라이스/zh 劈斩
 * 実行: node tools/_i18n_national_add.js
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'i18n');

// 12キー×9言語(=108値)。ja=正、他は公式語彙・既存訳流用。
const TR = {
  ja: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'この特性を持つポケモン数 (クリックで一覧)'
    },
    index: {
      section_national_heading: '全国版(全部入り)',
      section_national_sub: 'ポケモンチャンピオンズだけでなく、これまでの全シリーズの全ポケモン・全わざ・全特性・全持ち物を収録した全部入り版。',
      card_national_pokedex_title: '全国版ポケモン図鑑',
      card_national_pokedex_desc: '全シリーズの全ポケモン(全国版)を種族値・タイプ・特性・わざで検索・閲覧。',
      card_national_moves_title: '全わざリスト(全国版)',
      card_national_moves_desc: '全シリーズの全わざを収録。効果タグで「斬る技」「先制技」など細かく絞り込み。',
      card_national_items_title: '全持ち物(全国版)',
      card_national_items_desc: '昔のシリーズも含めた全持ち物の効果・入手方法をカテゴリ別に一覧。',
      card_national_abilities_title: '全特性一覧(全国版)',
      card_national_abilities_desc: '全シリーズの全特性(367)の効果と、その特性を持つポケモンを一覧で。'
    }
  },
  en: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'No. of Pokémon with this Ability (click for list)'
    },
    index: {
      section_national_heading: 'National (Complete Edition)',
      section_national_sub: 'Not just Pokémon Champions — a complete edition covering every Pokémon, move, Ability, and item from all past generations.',
      card_national_pokedex_title: 'National Pokédex',
      card_national_pokedex_desc: 'Search and browse every Pokémon from all generations (National) by base stats, type, Ability, and move.',
      card_national_moves_title: 'All Moves (National)',
      card_national_moves_desc: 'Every move from all generations. Narrow down in detail with effect tags like slicing moves, priority moves, and more.',
      card_national_items_title: 'All Items (National)',
      card_national_items_desc: 'Browse effects and how to obtain every item — including past generations — organized by category.',
      card_national_abilities_title: 'All Abilities (National)',
      card_national_abilities_desc: 'Effects of all 367 Abilities from every generation, with the Pokémon that have each one, all in one list.'
    }
  },
  fr: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'Nombre de Pokémon avec ce talent (cliquez pour la liste)'
    },
    index: {
      section_national_heading: 'National (Édition complète)',
      section_national_sub: 'Bien plus que Pokémon Champions : une édition complète regroupant tous les Pokémon, capacités, talents et objets de toutes les générations passées.',
      card_national_pokedex_title: 'Pokédex National',
      card_national_pokedex_desc: 'Recherchez et parcourez tous les Pokémon de toutes les générations (National) par statistiques de base, type, talent et capacité.',
      card_national_moves_title: 'Toutes les capacités (National)',
      card_national_moves_desc: "Toutes les capacités de toutes les générations. Filtrez finement par tags d'effet : capacités tranchantes, capacités prioritaires, etc.",
      card_national_items_title: 'Tous les objets (National)',
      card_national_items_desc: "Effets et méthodes d'obtention de tous les objets, y compris des générations passées, classés par catégorie.",
      card_national_abilities_title: 'Tous les talents (National)',
      card_national_abilities_desc: 'Effets de tous les talents (367) de toutes les générations, avec les Pokémon qui les possèdent, en une seule liste.'
    }
  },
  de: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'Anzahl der Pokémon mit dieser Fähigkeit (klicken für Liste)'
    },
    index: {
      section_national_heading: 'National (Komplett-Edition)',
      section_national_sub: 'Mehr als nur Pokémon Champions: Eine komplette Edition mit allen Pokémon, Attacken, Fähigkeiten und Items aus allen vergangenen Generationen.',
      card_national_pokedex_title: 'Nationaler Pokédex',
      card_national_pokedex_desc: 'Durchsuche und durchstöbere jedes Pokémon aller Generationen (National) nach Basiswerten, Typ, Fähigkeit und Attacke.',
      card_national_moves_title: 'Alle Attacken (National)',
      card_national_moves_desc: 'Alle Attacken aller Generationen. Filtere detailliert nach Effekt-Tags wie Schnitt-Attacken, Prioritäts-Attacken und mehr.',
      card_national_items_title: 'Alle Items (National)',
      card_national_items_desc: 'Effekte und Fundorte aller Items – auch vergangener Generationen – sortiert nach Kategorie.',
      card_national_abilities_title: 'Alle Fähigkeiten (National)',
      card_national_abilities_desc: 'Effekte aller 367 Fähigkeiten aus jeder Generation, mit den jeweiligen Pokémon, in einer Liste.'
    }
  },
  es: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'Número de Pokémon con esta habilidad (clic para ver la lista)'
    },
    index: {
      section_national_heading: 'Nacional (Edición completa)',
      section_national_sub: 'Más que Pokémon Champions: una edición completa que reúne a todos los Pokémon, movimientos, habilidades y objetos de todas las generaciones anteriores.',
      card_national_pokedex_title: 'Pokédex Nacional',
      card_national_pokedex_desc: 'Busca y consulta todos los Pokémon de todas las generaciones (Nacional) por estadísticas base, tipo, habilidad y movimiento.',
      card_national_moves_title: 'Todos los movimientos (Nacional)',
      card_national_moves_desc: 'Todos los movimientos de todas las generaciones. Filtra con detalle por etiquetas de efecto: movimientos cortantes, movimientos de prioridad, etc.',
      card_national_items_title: 'Todos los objetos (Nacional)',
      card_national_items_desc: 'Efectos y métodos de obtención de todos los objetos, incluidos los de generaciones anteriores, clasificados por categoría.',
      card_national_abilities_title: 'Todas las habilidades (Nacional)',
      card_national_abilities_desc: 'Efectos de las 367 habilidades de todas las generaciones, con los Pokémon que tienen cada una, en una sola lista.'
    }
  },
  it: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: 'Numero di Pokémon con questa abilità (clic per la lista)'
    },
    index: {
      section_national_heading: 'Nazionale (Edizione completa)',
      section_national_sub: "Molto più di Pokémon Champions: un'edizione completa con tutti i Pokémon, le mosse, le abilità e gli oggetti di ogni generazione passata.",
      card_national_pokedex_title: 'Pokédex Nazionale',
      card_national_pokedex_desc: "Cerca e sfoglia tutti i Pokémon di ogni generazione (Nazionale) per statistiche base, tipo, abilità e mossa.",
      card_national_moves_title: 'Tutte le mosse (Nazionale)',
      card_national_moves_desc: 'Tutte le mosse di ogni generazione. Filtra nel dettaglio per tag di effetto: mosse taglienti, mosse con priorità, ecc.',
      card_national_items_title: 'Tutti gli oggetti (Nazionale)',
      card_national_items_desc: 'Effetti e metodi di ottenimento di tutti gli oggetti, incluse le generazioni passate, organizzati per categoria.',
      card_national_abilities_title: 'Tutte le abilità (Nazionale)',
      card_national_abilities_desc: "Effetti di tutte le 367 abilità di ogni generazione, con i Pokémon che le possiedono, in un'unica lista."
    }
  },
  ko: {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: '이 특성을 가진 포켓몬 수 (클릭하여 목록 보기)'
    },
    index: {
      section_national_heading: '전국 (전체 수록)',
      section_national_sub: '포켓몬 챔피언스뿐만 아니라, 지금까지 모든 세대의 모든 포켓몬·기술·특성·아이템을 수록한 전체 수록판.',
      card_national_pokedex_title: '전국 포켓몬 도감',
      card_national_pokedex_desc: '모든 세대의 모든 포켓몬(전국)을 종족값·타입·특성·기술로 검색·열람.',
      card_national_moves_title: '전체 기술 목록(전국)',
      card_national_moves_desc: '모든 세대의 모든 기술을 수록. 효과 태그로「슬라이스 기술」「선제 기술」등 세밀하게 필터링.',
      card_national_items_title: '전체 아이템(전국)',
      card_national_items_desc: '과거 세대를 포함한 모든 아이템의 효과·입수 방법을 카테고리별로 정리.',
      card_national_abilities_title: '전체 특성 목록(전국)',
      card_national_abilities_desc: '모든 세대의 모든 특성(367)의 효과와, 그 특성을 가진 포켓몬을 한눈에.'
    }
  },
  'zh-Hans': {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: '拥有此特性的宝可梦数量（点击查看列表）'
    },
    index: {
      section_national_heading: '全国版（全集）',
      section_national_sub: '不仅是宝可梦冠军赛，更收录了迄今为止所有世代的全部宝可梦、招式、特性和道具的全集版。',
      card_national_pokedex_title: '全国宝可梦图鉴',
      card_national_pokedex_desc: '按种族值、属性、特性、招式，搜索并浏览所有世代的全部宝可梦（全国版）。',
      card_national_moves_title: '全部招式（全国版）',
      card_national_moves_desc: '收录所有世代的全部招式。可通过效果标签细筛「劈斩招式」「先制招式」等。',
      card_national_items_title: '全部道具（全国版）',
      card_national_items_desc: '按类别列出全部道具（含早期世代）的效果与获取方法。',
      card_national_abilities_title: '全部特性一览（全国版）',
      card_national_abilities_desc: '所有世代全部特性（367）的效果，以及拥有该特性的宝可梦一览。'
    }
  },
  'zh-Hant': {
    ability: {
      col_no_title: 'No.',
      col_pokemon_title: '擁有此特性的寶可夢數量（點擊查看列表）'
    },
    index: {
      section_national_heading: '全國版（全集）',
      section_national_sub: '不僅限於寶可夢冠軍賽，更收錄了迄今為止所有世代的全部寶可夢、招式、特性和道具的全集版。',
      card_national_pokedex_title: '全國寶可夢圖鑑',
      card_national_pokedex_desc: '按種族值、屬性、特性、招式，搜尋並瀏覽所有世代的全部寶可夢（全國版）。',
      card_national_moves_title: '全部招式（全國版）',
      card_national_moves_desc: '收錄所有世代的全部招式。可透過效果標籤細篩「劈斬招式」「先制招式」等。',
      card_national_items_title: '全部道具（全國版）',
      card_national_items_desc: '依類別列出全部道具（含早期世代）的效果與取得方式。',
      card_national_abilities_title: '全部特性一覽（全國版）',
      card_national_abilities_desc: '所有世代全部特性（367）的效果，以及擁有該特性的寶可夢一覽。'
    }
  }
};

const ORDER = ['ja','en','fr','de','es','it','ko','zh-Hans','zh-Hant'];
const ABILITY_KEYS = Object.keys(TR.ja.ability);   // 2
const INDEX_KEYS = Object.keys(TR.ja.index);        // 10
let report = [];

for (const L of ORDER) {
  const file = path.join(DIR, `ui-${L}.json`);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 既存キー保持(順序維持)しつつ新キーを末尾に追記
  j.ability = { ...(j.ability || {}), ...TR[L].ability };
  j.index = { ...(j.index || {}), ...TR[L].index };
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
  const a = ABILITY_KEYS.every(k => j.ability[k] != null);
  const i = INDEX_KEYS.every(k => j.index[k] != null);
  report.push(`${L}: ability[${ABILITY_KEYS.length}]=${a} index[${INDEX_KEYS.length}]=${i} (既存キー保持: ability ${Object.keys(j.ability).length}件)`);
}
console.log('=== 書き込み完了 ===');
console.log(report.join('\n'));
