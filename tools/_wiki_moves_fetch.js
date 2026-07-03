#!/usr/bin/env node
/* claude-design→glm-impl 依頼: ポケモンWiki(wiki.pokemonwiki.com)から28技の効果説明を取得。
 * 背景: moves_yakkunはYakkunの型名(img alt)を取りこぼし型名欠落。Wikiは平文で型名が入る=権威照合用。
 * 仕様書=reference/_wiki_moves_spec.md
 * UA偽装で403回避。節「説明文」と「たたかうわざ」を平文抽出(型名保持)。
 * 出力: reference/_moves_wiki.json = {技名: {説明文, たたかうわざ}}
 * 第9世代基準・世代フィルタ無視・でっち上げ禁止(取れないものは空)。
 *
 * Usage:
 *   node tools/_wiki_moves_fetch.js <技名>          # 1技だけ試行(検証用)
 *   node tools/_wiki_moves_fetch.js                  # 28技すべて
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TARGETS = [
  'ソニックブーム','りゅうのいかり','がまん','どくガス','キノコのほうし','サイコウェーブ','クモのす','テクスチャー2',
  'みやぶる','あられ','どろあそび','かぎわける','みずあそび','ミラクルアイ','テレキネシス','フリーフォール',
  'たがやす','プラズマシャワー','フラワーガード','ふんじん','サウザンアロー','サウザンウェーブ','アンカーショット',
  'プラズマフィスト','タールショット','たこがため','でんこうそうげき','ツタこんぼう'
];
// 「説明文」= ゲーム内説明文(世代別・型名平文=Yakkun相当)。「技の仕様」= メカニズム詳細(型名含む解説)
const SECTIONS = ['説明文','技の仕様'];
const OUT = path.join(__dirname, '..', 'reference', '_moves_wiki.json');

function decodeEnt(s){
  return s.replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d))
          .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
}
// 指定節の本文を h2 の mw-headline id="name" で正確に特定 → 次の <h2 まで(精度: 目次/別節の同名文字列への誤爆防止)
function sectionBody(html, name){
  const re = new RegExp('<h2[^>]*>(?:(?!<\\/h2>)[\\s\\S])*?class="mw-headline"[^>]*\\sid="' + name + '"[^>]*>(?:(?!<\\/h2>)[\\s\\S])*?<\\/h2>([\\s\\S]*?)(?=<h2\\b)', 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}
function plain(html){
  if(!html) return '';
  return decodeEnt(html)
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(p|dd|li|tr|div)>/gi,'\n')
    .replace(/<[^>]+>/g,'')
    .replace(/\r/g,'\n')
    .split('\n')
    .map(s=>s.replace(/[ \t]+/g,' ').trim())
    .filter(Boolean)
    .join(' / ');
}
function fetch(name){
  const url = 'https://wiki.pokemonwiki.com/wiki/' + encodeURIComponent(name);
  try{
    const html = execSync(`curl -s -A "${UA}" --max-time 30 "${url}"`, {encoding:'utf8', maxBuffer: 20*1024*1024});
    return html;
  }catch(e){ return null; }
}

const arg = process.argv[2];
const list = arg ? [arg] : TARGETS;

const result = {};
let miss = [];
for(const name of list){
  const html = fetch(name);
  if(!html || html.length < 1000){ miss.push(name+' (fetch失敗)'); result[name]={説明文:'',たたかうわざ:''}; continue; }
  const rec = {};
  for(const s of SECTIONS){
    rec[s] = plain(sectionBody(html, s));
  }
  // 両方空なら「ページ存在するが節無し」の可能性(リダイレクト/表記揺れ)
  if(!rec.説明文 && !rec.たたかうわざ){
    // h2 一覧を出して記録(原因調査用)
    const hs=[...html.matchAll(/<span class="mw-headline" id="([^"]+)">/g)].map(m=>m[1]);
    miss.push(name+' (節抽出空 headline=['+hs.slice(0,6).join(',')+'])');
  }
  result[name] = rec;
  process.stderr.write(`[ok] ${name}\n`);
  // 外部サーバーへの配慮(1技取得後に短い待機)
  try { execSync('sleep 0.4'); } catch(e) {}
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
const ok = Object.keys(result).filter(k=>result[k].説明文 || result[k].たたかうわざ).length;
console.log(`取得: ${ok}/${list.length}件 -> ${OUT}`);
if(miss.length){ console.log('注意/未取得:\n  ' + miss.join('\n  ')); }
