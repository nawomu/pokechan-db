'use strict';
// 全角英数字・記号を半角化する共有ユーティリティ(2026-09-04 一本化)。
//
// 背景: CLAUDE.md「英数字は半角で統一」(2026-08-01 阿部さんルール)の実装本体である zen2han() が
// tools/build_master_v2.js / build_views.js / _views_diff.js / _watch_official_news.js /
// _legacy_asset_test.js の5箇所にコピペされ、いずれも ０-９Ａ-Ｚａ-ｚ しか変換していなかった。
// 全角％＋－．(FF05/FF0B/FF0D/FF0E)を素通ししていたため、CLAUDE.mdが挙げる「１０％フォルム」等の
// 混入がツール側の非対応で今も残っていた(review/_zenkaku_audit_2026-09-04.md ①=最重要1)。
//
// 対象: Ａ-Ｚ ａ-ｚ ０-９ ％ ＋ － ．(全角パーセント/プラス/マイナス/ピリオド)。
// これらは全て Unicode 全角形式(U+FF00台)から半角(ASCII)へ -0x FEE0 の単一オフセットで変換できる
// (実測済み: ％→% ＋→+ －→- ．→.)。
//
// 使い方: const { zen2han } = require('./_lib/zen2han'); (tools/ 配下のファイルから)
function zen2han(s) {
  return String(s == null ? '' : s).replace(/[０-９Ａ-Ｚａ-ｚ％＋－．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

module.exports = { zen2han };
module.exports.zen2han = zen2han;
