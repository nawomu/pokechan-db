# HANDOFF 2026-09-01(火) ★レギュレーションM-C(2026-09-09〜)の予告分をマスターに先行追加

★**読む順**: ① `CLAUDE.md`「★★★データの絶対ルール」 → ② 本書 → ③ `reference/_regulations.json`

---

# 0. 何をしたか(阿部さん指示「M-Cの情報をネットで調べて、うちのDBにまず一回追加」)

公式発表(WCS2026閉会式 2026-08-30 PDT=8/31 JST)で**確定している5体+新特性1+メガストーン3**をマスターへ追加した。**master/*.json は生成物**なので、全部 `reference/` の入力ファイルに根拠つきで書き、`node tools/build_master_v2.js` で再生成した。

| 追加 | 中身 | 入力ファイル |
|---|---|---|
| ポケモン3体 | メガアブソルZ(あく/ゴースト・きれあじ・65/154/60/75/60/151) / メガルカリオZ(かくとう/はがね・はどうのぼうご・70/100/70/164/70/151) / メガガブリアスZ(ドラゴン単・ふゆう・108/130/85/141/85/151) | `reference/_pokemon_additions.json`(+`learnset_from`=元ポケモンの技を複写) |
| 印 | ゴリランダー/セグレイブ → `champions:true, regulation:"M-C"` + 重さ | `reference/_pokemon_fixes.json`(★既存の隠れ特性スロット修正とマージ済み。一度上書きで消しかけた=同名キーは必ずマージ) |
| 特性1 | はどうのぼうご「接触技(直接攻撃)の受けるダメージが半減する。」英=Aura Guard | **新設** `reference/_abilities_additions.json` |
| 持ち物3 | アブソルナイトZ/ルカリオナイトZ/ガブリアスナイトZ(implemented:false) | **新設** `reference/_items_additions.json` |
| レギュ | M-C(current:false, status:upcoming, 9/9〜12/2 10:59, 予告26種・確定5体) | **新設** `reference/_regulations.json`(builderがそのまま移す) |
| 画像 | `sprite_api_ids.js` に PokeAPI id(10307/10309/10310)を手動追記(生成元 pokeapi_master.json は現存しない) | 画像URLは PokeAPI raw(official-artwork/home)で200確認 |
| i18n | en/fr のポケモン名(PokeAPI公式)・en特性/持ち物名(公式プレス/Serebii)のみ追加。de/es/it/ko/zh は公式名が無いので**入れていない**(でっち上げ禁止) | `i18n/en.json` `i18n/fr.json` |
| builder | 特性/持ち物の追加口・レギュ一覧ファイル・追加ポケモンの特性カウント・learnset複写 を配線 | `tools/build_master_v2.js` |

- `regulation:"M-C"` の行=「**M-Cで追加予定**(現行M-Bでは使えない)」の印。`champions:true` も立てている(Champions版絞り込みに出る)。
- 番人 `node tools/_ssot_guard_test.js` ✅悪化なし / data_browser.html 実機(Playwright)=5体表示・JSエラー0・healthCheck ok。
- 出典は各行の `source`/`根拠` に全部書いた。値の裏取り=ヤックン/ch/(「まだ実装されていません」参考情報)=ヤックン/za/=Bulbapedia=PokeAPI の一致。

# 1. ★9/9(水)にやること(レギュ切替の手順)
★前提(阿部さん 2026-09-01 確定): **レギュは累積**=M-Bで使えたものは全部M-Cでも使える+新規26体(確定5・残り21は公式待ち)。バトル(real_battle)も現行レギュ=累積の集合を使う。builderは REGULATION を変えるだけで seasons が伸びる規則にしてある。
1. `reference/_regulations.json`: M-B の `current:false` → M-C を `current:true`(順番も M-C を先頭に。pokedb.js の `regulation()` は items[0])
2. `tools/build_master_v2.js` の `REGULATION = 'M-B'` → `'M-C'`(レギュは累積=M-Bの行は全部M-Cになる)
3. 再ビルド → `node tools/build_views.js` → `_views_diff` → `_views_pdca_playwright` → 番人 → **ヤックン/ch/ の3体ページが「実装済み」になったら値を突き合わせて上書き**(canonルール③。技=Champions固有の没収があり得る→`learnsets` の `copied_from` 行を権威で差し替え)
4. ナイトZ 3つの入手方法(VP価格)を `/ch/item.htm` で確認して `_items_additions.json` の effect_ja を更新
5. 残り21体(26−5)は**公式の追加発表を待って**から足す(ネットの予想リストは採らない)

# 2. 阿部さんの質問「攻略サイトは種族値をどこから持ってきたのか/公式の最新情報はどこか」(調査結果)
- **3体の種族値は今回の発表で出たものではない**。メガアブソルZ/メガルカリオZ=『Pokémon LEGENDS Z-A』DLC「メガディメンション」(2025-12)、メガガブリアスZ=同作の配信(2026-02-27)で**既にゲーム内に存在**していた姿。種族値は公式が文書で出すものではなく、ゲームデータ(HOME連携含む)から判明した値を Serebii/Bulbapedia/ポケ徹(/za/)/PokeAPI が載せている。ChampionsはHOMEと同じ値を使うので、各サイトはZ-Aの値をそのまま「参考情報」として掲載(ポケ徹/ch/は「まだ実装されていません」と明記)。
- **今回の公式発表で新しく出たのは**: 開催期間・追加ポケモン名・タイプ・特性(はどうのぼうご=新)・高さ/重さ・「メガシンカは1戦1回」。
- **公式の一次情報(新しい順の出どころ)**: ①WCS2026閉会式トレーラー(8/30 PDT) ②ポケモンHOME公式ニュース `news.pokemon-home.com/ja/page/816.html`(JPのレギュ告知はここが一次) ③ポケモン公式X @Pokemon_cojp / @Pokemon / @NintendoAmerica ④公式プレス: `press.pokemon.com`(北米・要ログイン) / `asia-press.portal-pokemon.com/press-release/pokemon-champions_20260830/`(アジア・タイプ/特性/高さ重さ/英語名あり=**一番中身が濃い**) ⑤`pokemon.com/us/news`(閉会式リキャップ) ⑥Champions公式サイト `champions.pokemon.com/en-us/news/`(M-C記事は9/1時点で未掲載・JP版URLは404で未特定)。
- **二次(速い)**: Serebii.net / PLDH / ポケ徹ニュース / Game*Spark。**真の正典は 9/9 以降のゲーム内(Championsアプリの図鑑)**。

# 3. 未push
コミット済み・**pushは阿部さんの確認後**(本番 data_browser に M-C 行が先出しで載るため)。

---
# 4. 同日午後: ZA欠け補完+「マスター→ページ」の道を開通(段A〜E)
- ZA欠け全数(メガ11+見た目3+ストーン8)をマスターへ(`092cb4cf`)。特性は「未解禁」=空。
- **計画書 `計画_マスターからページへ流す_2026-09-01.md`** に沿って: 段B(資産移送) → 段C(生成器 `tools/build_views.js`+差分器) → 段E(builder入力を `reference/_legacy_snapshot/` へ=循環を断つ) → 段D(生成物3本入れ替え)。**全ページがマスターの内容で動く**(1273/318体・技919・持ち物180)。実機ゲート=`tools/_views_pdca_playwright.js` 7ページ✅。
- ★以後の運用: master入力を直す → build_master_v2 → build_views → _views_diff → 実機。**生成物3本は手で直さない**(CLAUDE.md に追記済み)。
- 残り: 段F(コンテンツページ4,900枚の再生成・全国版まで広げるかは阿部さん判断)/段G(i18n入力をmasterへ)/段H(9/9)。
- **未push**(阿部さん確認後)。

# 5. 同日夜: 段F完了・累積レギュ・M-C列(全部push済み)
- 段F=コンテンツ静的ページを全国版へ(14,463枚)。`GEN_LANGS=ja,en,fr,de,es,it,ko,zh-Hans,zh-Hant node tools/_gen_content_pages.js` → `node tools/_gen_content_sitemap.js`(★既定は ja,en だけ=hreflang が2言語分になるので必ず9言語指定)。
- レギュ累積(阿部さん確定)= builder が REGULATION 切替だけで seasons を伸ばす。Champions版DB SSN列に🔜M-C(絞り込み可)。
- 残宿題: 段G(i18n辞書の旧名キー穴=ジガルデ(50%フォルム)等が8言語無し・build_i18n_entities.js の入力を master へ)/段H(9/9)/全国限定ポケモンの learners 残差51件/非ja孤児ページ39枚×8言語。

# 6. 同日深夜: 段G(英語版)・バトルM-C対応・X文面(全部push済み)
- **段G** `93888b44`: `build_i18n_entities.js` の入力を master/ へ。旧名キーの穴(ポケモン13/特性2/持ち物11×8言語)を解消。合成した名前は各辞書 `_meta.synthesized`。監査=データ名の残ja 0(残るのは waza-list_all の🔒フーパ専用チップの直書き=既存・別件、はどうのぼうご非jaは公式文なし=設計どおり)。
- **バトル** `(このコミット)`: 阿部さん指示でM-C分だけ③凍結の例外。P10b はどうのぼうご/P12 ねつこうかん/持ち物→mega_form解決/🔜M-C印/スプライト3枚。検査 `node tools/_mc_engine_check.js`(19/19)。未実装特性の残り≈70件は凍結のまま。
- **X投稿文面** `宣伝_X投稿文面_M-C対応_2026-09-01.md`(推奨X-6=272字・dry-run済み)。投稿は阿部さん。
- 教訓: 並走エージェントが `git stash` を使い、もう1本の作業ファイルを一時的に戻した(復旧済み)。**並走中の blanket stash/checkout 禁止**(agent-file-commit-lockout と同型)。
- 残: 段H(9/9切替)/21体の公式発表待ち/全国限定 learners 残差51件/非ja孤児ページ39×8/waza-list_all のフーパ直書き/未実装特性70件(凍結)。
