#!/usr/bin/env node
'use strict';
// X (Twitter) API v2 自動投稿 + メディア(v1.1 chunked upload)。依存ゼロ(Node24ネイティブfetch/crypto)。
//   node tools/_x_post.js --text "投稿文" [--media FILE.mp4|gif|png|jpg|webp] [--dry-run]
// 認証=OAuth 1.0a user context(HMAC-SHA1署名をcryptoで自前実装・percent-encode RFC3986)。
//   4キー(consumer_key/secret + access_token/secret)は ~/.pchamdb_sns.json の x ブロックへ。
// セットアップは tools/SNS自動化_セットアップ手順.md のXセクション(Free枠=月数百投稿で十分)。
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const UPLOAD_BASE = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEETS_URL = 'https://api.twitter.com/2/tweets';
const CHUNK = 4 * 1024 * 1024; // Twitter推奨チャンク上限4MB

const USAGE = `X (Twitter) 自動投稿 (API v2 + メディア chunked v1.1)

使い方:
  node tools/_x_post.js --text "投稿文" [--media FILE] [--dry-run]

オプション:
  --text "..."     投稿テキスト(必須)
  --media PATH     添付メディア(.mp4/.mov/.gif/.png/.jpg/.jpeg/.webp)
  --dry-run        ネット送信せず内容と文字数(X weighted目安)を表示
  --help, -h       このヘルプ

認証(OAuth 1.0a): ~/.pchamdb_sns.json の "x" に4キーを入れる:
  consumer_key / consumer_secret / access_token / access_token_secret
手順は tools/SNS自動化_セットアップ手順.md
`;

function parseArgs(argv) {
  const out = { text: null, media: null, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--text') out.text = argv[++i];
    else if (a.startsWith('--text=')) out.text = a.slice(7);
    else if (a === '--media') out.media = argv[++i];
    else if (a.startsWith('--media=')) out.media = a.slice(8);
  }
  return out;
}

function cfgPath() { return path.join(os.homedir(), '.pchamdb_sns.json'); }
function loadConfig() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; } }
function getXCreds() {
  const x = (loadConfig().x) || {};
  for (const k of ['consumer_key', 'consumer_secret', 'access_token', 'access_token_secret']) {
    if (!x[k] || !String(x[k]).trim())
      throw new Error(`X認証情報が足りません: ~/.pchamdb_sns.json の x.${k} を設定してください(手順: tools/SNS自動化_セットアップ手順.md)`);
  }
  return { ck: x.consumer_key, cs: x.consumer_secret, at: x.access_token, ats: x.access_token_secret };
}

// RFC3986 percent-encode。encodeURIComponentは !*'() を逃すので補う。
function pctEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/'/g, '%27');
}
function hmacSha1B64(key, data) { return crypto.createHmac('sha1', key).update(data, 'utf8').digest('base64'); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 署名ベース文字列 = METHOD & pct(baseUrl) & pct(sorted params joined)。
// paramsToSign には query/body(form-urlencoded)の両パラメータを統合して渡す(multipart/JSON body は含めない)。
function oauthSign(method, baseUrl, paramsToSign, creds) {
  const oauth = {
    oauth_consumer_key: creds.ck,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.at,
    oauth_version: '1.0',
  };
  const all = Object.assign({}, paramsToSign || {}, oauth);
  const paramString = Object.keys(all).sort().map((k) => `${pctEncode(k)}=${pctEncode(all[k])}`).join('&');
  const base = method.toUpperCase() + '&' + pctEncode(baseUrl) + '&' + pctEncode(paramString);
  const signingKey = pctEncode(creds.cs) + '&' + pctEncode(creds.ats); // token_secret 付き鍵
  return { oauth: Object.assign({}, oauth, { oauth_signature: hmacSha1B64(signingKey, base) }) };
}
function authHeader(oauth) {
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pctEncode(k)}="${pctEncode(oauth[k])}"`).join(', ');
}

// paramsToSign は query として URL に付与(POSTでもTwitterは許容)→ 同値で署名。
// multipart(APPEND)・JSON(/2/tweets) は paramsToSign={} で body は署名に含めない。
async function xFetch(method, baseUrl, paramsToSign, creds, fetchOpts) {
  let url = baseUrl;
  const ps = paramsToSign || {};
  if (Object.keys(ps).length) url += '?' + Object.keys(ps).map((k) => `${pctEncode(k)}=${pctEncode(ps[k])}`).join('&');
  const { oauth } = oauthSign(method, baseUrl, ps, creds);
  const headers = Object.assign({ Authorization: authHeader(oauth) }, fetchOpts.headers || {});
  const res = await fetch(url, { method, headers, body: fetchOpts.body });
  const txt = await res.text();
  let json = null; try { json = JSON.parse(txt); } catch {}
  if (!res.ok) throw new Error(`X API ${res.status} (${method} ${url}): ${txt.slice(0, 500)}`);
  return json || {};
}

function mediaSpec(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  let media_type, category, isVideo = false;
  switch (ext) {
    case 'mp4': media_type = 'video/mp4'; category = 'tweet_video'; isVideo = true; break;
    case 'mov': media_type = 'video/quicktime'; category = 'tweet_video'; isVideo = true; break;
    case 'gif': media_type = 'image/gif'; category = 'tweet_gif'; isVideo = true; break;
    case 'png': media_type = 'image/png'; category = 'tweet_image'; break;
    case 'jpg': case 'jpeg': media_type = 'image/jpeg'; category = 'tweet_image'; break;
    case 'webp': media_type = 'image/webp'; category = 'tweet_image'; break;
    default: throw new Error(`未対応の拡張子 .${ext}(対応: mp4/mov/gif/png/jpg/jpeg/webp)`);
  }
  return { ext, media_type, category, isVideo };
}

// multipart/form-data を手組み(依存ゼロ)。fileBuf があれば media フィールドへ。
function buildMultipart(fields, fileBuf) {
  const boundary = '----pchamdb' + crypto.randomBytes(12).toString('hex');
  let head = '';
  for (const [k, v] of Object.entries(fields)) {
    head += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  let pre = head;
  if (fileBuf) {
    pre += `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="blob"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  }
  const tail = `\r\n--${boundary}--\r\n`;
  const body = fileBuf
    ? Buffer.concat([Buffer.from(pre, 'utf8'), fileBuf, Buffer.from(tail, 'utf8')])
    : Buffer.from(pre + tail, 'utf8');
  return { contentType: 'multipart/form-data; boundary=' + boundary, body };
}

// X の重み付き文字数(目安)。URLは23字換算・全角・CJK・絵文字は2重み。
function xWeightedLen(text) {
  const noUrl = text.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23));
  let len = 0;
  for (const ch of noUrl) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x1100 && c <= 0x115F) || (c >= 0x2E80 && c <= 0xA4CF) ||
      (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) ||
      (c >= 0xFE10 && c <= 0xFE19) || (c >= 0xFE30 && c <= 0xFE6F) ||
      (c >= 0xFF01 && c <= 0xFF60) || (c >= 0xFFE0 && c <= 0xFFE6) ||
      (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x20000 && c <= 0x2FFFD) ||
      (c >= 0x30000 && c <= 0x3FFFD)
    ) len += 2; else len += 1;
  }
  return len;
}

// chunked upload: INIT(query) → APPEND(multipart/分割) → FINALIZE(query) → STATUS poll(動画/GIF)
async function uploadMedia(filePath, creds) {
  const spec = mediaSpec(filePath);
  const buf = fs.readFileSync(filePath);
  const total = buf.length;

  const initRes = await xFetch('POST', UPLOAD_BASE, {
    command: 'INIT', total_bytes: String(total), media_type: spec.media_type, media_category: spec.category,
  }, creds, { method: 'POST', headers: {} });
  const mediaId = initRes.media_id_string;
  if (!mediaId) throw new Error('INIT失敗: media_id_stringが返らない ' + JSON.stringify(initRes).slice(0, 300));

  const segments = Math.max(1, Math.ceil(total / CHUNK));
  for (let i = 0; i < segments; i++) {
    const start = i * CHUNK, end = Math.min(start + CHUNK, total);
    const chunk = buf.subarray(start, end);
    const mp = buildMultipart({ command: 'APPEND', media_id: mediaId, segment_index: String(i) }, chunk);
    // multipart body は署名に含めない → paramsToSign={}
    await xFetch('POST', UPLOAD_BASE, {}, creds, {
      method: 'POST', headers: { 'Content-Type': mp.contentType, 'Content-Length': String(mp.body.length) }, body: mp.body,
    });
    process.stdout.write(`\rAPPEND ${i + 1}/${segments} (${Math.round(end / total * 100)}%)`);
  }
  process.stdout.write('\n');

  const finRes = await xFetch('POST', UPLOAD_BASE, { command: 'FINALIZE', media_id: mediaId }, creds, { method: 'POST', headers: {} });
  if (finRes.processing_info) {
    let state = finRes.processing_info.state;
    while (state === 'pending' || state === 'in_progress') {
      await sleep(2000);
      const st = await xFetch('GET', UPLOAD_BASE, { command: 'STATUS', media_id: mediaId }, creds, { method: 'GET', headers: {} });
      state = (st.processing_info && st.processing_info.state) || state;
      process.stdout.write(`\rメディア処理中: ${state}    `);
      if (state === 'failed') throw new Error('メディア処理失敗: ' + JSON.stringify(st.processing_info || {}).slice(0, 300));
    }
    process.stdout.write('\n');
  }
  return mediaId;
}

async function postTweet(text, mediaIds, creds) {
  const payload = { text };
  if (mediaIds && mediaIds.length) payload.media = { media_ids: mediaIds };
  // JSON body は署名に含めない → paramsToSign={}
  return xFetch('POST', TWEETS_URL, {}, creds, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(USAGE); return; }
  if (!args.text) { console.error('エラー: --text が必須です\n\n' + USAGE); process.exit(2); }

  const wlen = xWeightedLen(args.text);
  console.log(`文字数(X weighted目安): ${wlen} / 280 ${wlen > 280 ? '⚠超過' : 'OK'}`);

  let mediaIds = null;
  if (args.media) {
    if (!fs.existsSync(args.media)) { console.error(`メディアが見つかりません: ${args.media}`); process.exit(2); }
    if (args.dryRun) {
      const spec = mediaSpec(args.media);
      const sz = fs.statSync(args.media).size;
      console.log(`[dry-run] メディア: ${args.media} (${spec.media_type}/${spec.category}, ${(sz / 1048576).toFixed(2)}MB, チャンク${Math.max(1, Math.ceil(sz / CHUNK))})`);
      mediaIds = ['DRYRUN'];
    } else {
      const creds = getXCreds();
      mediaIds = [await uploadMedia(args.media, creds)];
    }
  }

  if (args.dryRun) {
    console.log(`[dry-run] 投稿文: ${JSON.stringify(args.text)}`);
    console.log(`[dry-run] → POST /2/tweets ${mediaIds ? '{ media_ids: [' + mediaIds.join(',') + '] }' : ''}`);
    return;
  }
  if (wlen > 280) { console.error('テキストが280超過です。短くして再実行してください。'); process.exit(2); }

  const creds = getXCreds();
  const r = await postTweet(args.text, mediaIds, creds);
  const id = r && r.data && r.data.id;
  console.log(id ? ('投稿完了: https://x.com/i/web/status/' + id) : ('投稿完了(詳細): ' + JSON.stringify(r)));
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
