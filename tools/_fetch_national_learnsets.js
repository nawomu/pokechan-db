#!/usr/bin/env node
// 全国版(非Champions)944体の「覚える技」をPokeAPIから取得する(LLM不使用・トークン消費ゼロ)
//
// なぜ(2026-08-01 阿部さん決定):
//   master/learnsets.json は Champions 313体分だけ。全国版944体分が無い。
//   目的=今後Championsに新ポケモンが追加されたら即対応できる下ごしらえ。
//   ★9世代までに廃止された技も含めて取り、廃止の印を付けられる形で保存する。
//   ★Championsに追加された時は9世代との差分を記録してからChampions値で上書きする(canonルール)。
//
// 出力: reference/_pokeapi_learnsets_raw.json(生の取得結果。masterへの反映はビルダー側で別途)
//   ★reference/_old_master/ には書かない(止め金の対象=旧マスターは死んだ場所)
// 再開可能: 既に取れている分はスキップ(途中で止まってももう一度走らせればいい)

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'reference', '_pokeapi_learnsets_raw.json');

const master = JSON.parse(fs.readFileSync(path.join(ROOT, 'master', 'pokemon.json'), 'utf8'));
const slugmap = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference', '_pokemon_slug_map.json'), 'utf8'));
const oursMega = new Set(slugmap.matched.filter(m => m.method === 'ours_champions_mega').map(m => m.slug));

// 対象 = Championsに居ない944体(Champions 313体は権威データが正典なので触らない)
//   ★自作メガのslug(PokeAPIに実在しない)は除外
const targets = master.items
  .filter(p => !p.champions && p.slug && !oursMega.has(p.slug))
  .map(p => ({ name: p.name, slug: p.slug, no: p.no }));

let store = { what: 'PokeAPI 覚える技の生データ(全国版・非Champions)', fetched: {} };
try { store = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const todo = targets.filter(t => !store.fetched[t.slug]);
  console.log(`対象 ${targets.length}体 / 取得済み ${targets.length - todo.length} / 残り ${todo.length}`);
  let n = 0, fail = 0;
  for (const t of todo) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${t.slug}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      // 保存は最小限: 技slug → その技を覚えるversion_group一覧(世代判定・廃止判定に使う)
      const moves = (d.moves || []).map(m => ({
        move: m.move.name,
        vgs: [...new Set((m.version_group_details || []).map(v => v.version_group.name))],
      }));
      store.fetched[t.slug] = { name: t.name, no: t.no, moves };
      n++;
      if (n % 25 === 0) {
        fs.writeFileSync(OUT, JSON.stringify(store));
        console.log(`進捗 ${n}/${todo.length}(失敗 ${fail})`);
      }
    } catch (e) {
      fail++;
      console.log(`FAIL ${t.slug}: ${e.message}`);
      if (fail > 30) { console.log('失敗が多すぎるので停止(ネットワーク要確認)'); break; }
    }
    await sleep(150); // PokeAPIに礼儀正しく
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  const got = Object.keys(store.fetched).length;
  console.log(`DONE 取得済み合計 ${got}/${targets.length}(今回 ${n}件・失敗 ${fail}件)`);
  if (got >= targets.length) console.log('COMPLETE');
})();
