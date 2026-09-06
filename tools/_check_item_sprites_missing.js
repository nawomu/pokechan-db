#!/usr/bin/env node
'use strict';
// 道具画像が無い slug の台帳を作り、PokeAPI に追加されたら取り込む(2026-09-06 阿部さん「40個ないのは記録して、APIに追加されたらやる」)。
//   node tools/_check_item_sprites_missing.js          → 無い一覧を reference/_item_sprites_missing.json に書く(master + images/item/_manifest.json から導出)
//   node tools/_check_item_sprites_missing.js --fetch  → 無い分を PokeAPI sprites repo に問い合わせ、あれば images/item/ に保存 → manifest 再生成
// ・対象= master/items.json で pokeapi_slug を持つのに images/item/<slug>.png が無い道具(第八/九世代の道具など。2026-09-06 時点 40 件)
// ・pokeapi_slug 自体が無い道具(Champions 新規メガストーン46 など)は PokeAPI に存在しない=ここでは扱わない(画像方針=阿部さん判断)
// ・画像はサイト資産であってデータではない → master には何も書かない。取り込んだら items_list は `node tools/_build_items_list.js` で再生成
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'images/item');
const OUT = path.join(ROOT, 'reference/_item_sprites_missing.json');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
const doFetch = process.argv.includes('--fetch');

const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'master/items.json'), 'utf8'));
const items = Array.isArray(m.items) ? m.items : Object.values(m.items || m);
const missing = items.filter(it => it.pokeapi_slug && !fs.existsSync(path.join(IMG, it.pokeapi_slug + '.png')))
  .map(it => ({ slug: it.slug, name: it.name, pokeapi_slug: it.pokeapi_slug, url: BASE + it.pokeapi_slug + '.png' }));

async function main() {
  let got = 0;
  if (doFetch) {
    for (const it of missing) {
      try {
        const r = await fetch(it.url);
        if (r.status === 200) {
          fs.writeFileSync(path.join(IMG, it.pokeapi_slug + '.png'), Buffer.from(await r.arrayBuffer()));
          console.log(`  ✓ 取得 ${it.pokeapi_slug} (${it.name})`);
          got++;
        } else console.log(`  - まだ無い ${it.pokeapi_slug} (${it.name}) HTTP ${r.status}`);
      } catch (e) { console.log(`  ✗ ${it.pokeapi_slug}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 300));
    }
    if (got) require('child_process').execFileSync('node', [path.join(__dirname, '_gen_item_sprite_manifest.js')], { stdio: 'inherit' });
  }
  const still = missing.filter(it => !fs.existsSync(path.join(IMG, it.pokeapi_slug + '.png')));
  fs.writeFileSync(OUT, JSON.stringify({
    note: 'pokeapi_slug はあるが PokeAPI sprites repo に絵が無い道具。node tools/_check_item_sprites_missing.js --fetch で再確認・取込。pokeapi_slug の無い道具(Champions新規メガストーン等)は対象外',
    checked_at: new Date().toISOString().slice(0, 10),
    count: still.length,
    items: still.map(({ slug, name, pokeapi_slug }) => ({ slug, name, pokeapi_slug })),
  }, null, 2) + '\n');
  console.log(`画像なし(slug有り): ${still.length} 件 → ${path.relative(ROOT, OUT)}` + (doFetch ? ` / 今回取得 ${got}` : ''));
  if (got) console.log('→ 次: node tools/_build_items_list.js(items_list 再生成)');
}
main().catch(e => { console.error('ERR', e.message); process.exitCode = 1; });
