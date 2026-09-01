# _legacy_snapshot — 旧生成物の凍結スナップショット(2026-09-01・段E)

`pokechan_data.js` / `pokechan_data_all.js` / `items_database.js` の **2026-09-01 時点の旧版**をそのまま置いたもの。
`tools/build_master_v2.js` はここを「土台(器と旧資産)」として読む。**ルート直下の同名ファイルは `tools/build_views.js` が master/ から生成した“ビュー”**であり、builderの入力ではない(=循環を断った)。

- ここは**手で直さない・更新しない**(凍結)。足りないものは `reference/_*_additions.json` / `_*_fixes.json` に書く。
- 旧版の差分検査: `node tools/_views_diff.js`(旧=ここ / 新=ルートの生成物)。
