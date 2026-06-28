# composeが読むeffect.kind スキーマ表(本番pokechan_data.jsから抽出・推測で足すな)

## 許容値
- stat(英語): attack, speed, special_defense, defense, evasion, accuracy, special_attack, all
- target: self, opponent, all_but_self, all_opponents, team, all, opponent_team, field, party, ally, incoming
- phase: this_turn, on_use, lasting, delayed, turn_end
- 状態付与 value: やけど, こおり, まひ, バインド, こんらん, ねむり, どく, もうどく, ちいさくなる, きゅうしょアップ, ひるみ, まひ,やけど,こおり, のろい, ねむけ, おいかぜ, でんじふゆう, うちおとす, どく,まひ,ねむり, しおづけ, みがわり, あめまみれ, かいふくふうじ
- 天候変化 value: すなあらし, あめ, にほんばれ, ゆき
- フィールド展開 value: グラスフィールド, ミストフィールド, エレキフィールド, サイコフィールド

## kind一覧(頻度順・フィールド・例)

### 能力ランク変化 (本番134件)
- fields: kind, target, stat, stages, phase, stats, modifier, prob, reset, effect, condition, to_max, stat_choice, fails_if_target_state, note, airborne_too, on_charge_turn, timing
- 例: {"kind":"能力ランク変化","target":"self","stat":"attack","stages":2,"phase":"on_use"}

### 状態付与 (本番92件)
- fields: kind, target, phase, value, prob, duration, turn_end_damage, prevents_switch, immune, trigger, bypasses_substitute, note, effect, affected_moves, generation_notes, duration_turns, crit_stages, forced, selection, condition, delay_turns, removed_if, multiplier, stat, detail, grants_immunity_to, substitute_hp, tick_effect, prevents
- 例: {"kind":"状態付与","target":"opponent","phase":"on_use","value":"やけど","prob":10}

### 威力倍率 (本番37件)
- fields: kind, target, phase, multiplier, condition, applies_to, note
- 例: {"kind":"威力倍率","target":"self","phase":"this_turn","multiplier":1.2,"condition":{"type":"ability","value":"てつのこぶし"}}

### 回復 (本番25件)
- fields: kind, target, fraction, phase, basis, condition, delay_turns, trigger, of, heals_replacement, note_structured, duration, note_target, amount
- 例: {"kind":"回復","target":"self","fraction":0.5,"phase":"on_use","basis":"max_hp"}

### 威力可変 (本番18件)
- fields: kind, target, phase, basis, tiers, relation, power_min, power_max, multiplier, condition, based_on, power_table, formula, max_power, note, weight_thresholds, table, base_power, per_stage, scales_with, per_hit_taken, reset_at_turn_end
- 例: {"kind":"威力可変","target":"opponent","phase":"on_use","basis":"target_weight","tiers":[{"max_kg":10,"power":20},{"max_kg":25,"power":40},{"max_kg":50,"power":60},{"max_kg":100,"power":80},{"max_kg":200,"power":100},{"min_kg":200,"power":120}]}

### 急所率上昇 (本番17件)
- fields: kind, target, phase, stages, always_crit, condition
- 例: {"kind":"急所率上昇","target":"self","phase":"on_use","stages":1}

### 必中 (本番15件)
- fields: kind, target, phase, condition, ignores
- 例: {"kind":"必中","target":"opponent","phase":"on_use","condition":{"type":"target_minimized"}}

### 連続攻撃 (本番15件)
- fields: kind, target, phase, min_hits, max_hits, hits_by, note, hits, doubles_note, stop_on_miss, power_per_hit
- 例: {"kind":"連続攻撃","target":"opponent","phase":"on_use","min_hits":2,"max_hits":5}

### 状態異常回復 (本番15件)
- fields: kind, target, phase, value, values, usable_while_frozen, note
- 例: {"kind":"状態異常回復","target":"self","phase":"on_use"}

### ひるみ (本番13件)
- fields: kind, target, phase, prob
- 例: {"kind":"ひるみ","target":"opponent","phase":"on_use","prob":30}

### 2ターン目に攻撃 (本番10件)
- fields: kind, target, phase, duration, semi_invulnerable, vulnerable_to, vulnerable_if, skip_charge_if_weather
- 例: {"kind":"2ターン目に攻撃","target":"self","phase":"lasting","duration":1,"semi_invulnerable":"空中","vulnerable_to":["うちおとす","かぜおこし","かみなり","サウザンアロー","スカイアッパー","たつまき","ぼうふう"],"vulnerable_if":["特性ノーガード"]}

### 反動 (本番9件)
- fields: kind, target, phase, fraction
- 例: {"kind":"反動","target":"self","phase":"on_use","fraction":0.33}

### 吸収 (本番8件)
- fields: kind, target, phase, fraction, basis, of
- 例: {"kind":"吸収","target":"self","phase":"on_use","fraction":0.5,"basis":"damage_dealt"}

### 自分交代 (本番7件)
- fields: kind, target, phase, pass, replacement, needs_research, pass_to_replacement
- 例: {"kind":"自分交代","target":"self","phase":"on_use","pass":["能力ランク変化","一部の状態変化"],"replacement":"任意","needs_research":"引き継ぐ状態変化は一部のみ(全部ではない)。みがわり/やどりぎ/きあいだめ等は引き継ぎ、ちょうはつ/メロメロ等は引き継がない。正確なリストは要調査"}

### みがわり貫通 (本番7件)
- fields: kind, target, phase
- 例: {"kind":"みがわり貫通","target":"opponent","phase":"on_use"}

### 半無敵命中 (本番6件)
- fields: kind, target, phase, hits_state, damage_multiplier, note
- 例: {"kind":"半無敵命中","target":"all_but_self","phase":"on_use","hits_state":["水中"],"damage_multiplier":2}

### 次のターン行動不能 (本番6件)
- fields: kind, target, phase
- 例: {"kind":"次のターン行動不能","target":"self","phase":"lasting"}

### 自分瀕死 (本番6件)
- fields: kind, target, phase
- 例: {"kind":"自分瀕死","target":"self","phase":"on_use"}

### HPが減る (本番6件)
- fields: kind, target, phase, fraction, can_faint_self, condition, rounding, always_pays_even_if_blocked
- 例: {"kind":"HPが減る","target":"self","phase":"on_use","fraction":0.25}

### まもり (本番6件)
- fields: kind, target, phase, consecutive_success_multiplier, partial_bypass, blocks_priority_only, effect, blocks_status_moves
- 例: {"kind":"まもり","target":"self","phase":"this_turn","consecutive_success_multiplier":0.3333,"partial_bypass":[{"by":"dynamax_move_attacking","damage_fraction":0.25},{"by":"gen7_zmove_attacking","damage_fraction":0.25}]}

### 設置 (本番6件)
- fields: kind, target, phase, duration, value, max_layers, damage_on_switch_in, immune, on_switch_in, timing
- 例: {"kind":"設置","target":"opponent_team","phase":"lasting","duration":"消えるまで","value":"まきびし","max_layers":3,"damage_on_switch_in":[{"layers":1,"fraction":0.125},{"layers":2,"fraction":0.1667},{"layers":3,"fraction":0.25}],"immune":[{"type":"target_type","value":"ひこう"},{"type":"target_ability","value":"ふゆう"}]}

### 固定ダメージ (本番5件)
- fields: kind, target, phase, amount, champions_amount, minimum
- 例: {"kind":"固定ダメージ","target":"opponent","phase":"on_use","amount":"自分のレベル分","champions_amount":50}

### 天候変化 (本番5件)
- fields: kind, target, phase, duration, value, side_effects
- 例: {"kind":"天候変化","target":"field","phase":"lasting","duration":5,"value":"すなあらし"}

### 設置除去 (本番5件)
- fields: kind, target, phase, values, value, auto_removed_by, detail
- 例: {"kind":"設置除去","target":"team","phase":"on_use","values":["ステルスロック","どくびし","まきびし","ねばねばネット"]}

### 場の威力補正 (本番5件)
- fields: kind, target, phase, duration, move_type, multiplier, condition, moves
- 例: {"kind":"場の威力補正","target":"all","phase":"lasting","duration":5,"move_type":"くさ","multiplier":1.3,"condition":{"type":"user_grounded"}}

### 一撃必殺 (本番4件)
- fields: kind, target, phase, ignores_type_matchup
- 例: {"kind":"一撃必殺","target":"opponent","phase":"on_use","ignores_type_matchup":true}

### 暴れる(混乱) (本番4件)
- fields: kind, target, phase, duration
- 例: {"kind":"暴れる(混乱)","target":"self","phase":"lasting","duration":[2,3]}

### 倍返し (本番4件)
- fields: kind, target, phase, multiplier, basis, ignores_type_matchup, doubles_note, requires_damage_taken, category, ignores_type_effectiveness, double_battle, source, redirect_to, redirects_to
- 例: {"kind":"倍返し","target":"opponent","phase":"on_use","multiplier":2,"basis":"last_physical_damage_taken","ignores_type_matchup":true,"doubles_note":"最後に受けた物理わざのダメージだけが対象","requires_damage_taken":true}

### 壁設置 (本番4件)
- fields: kind, value, target, phase, duration, reduces, multiplier, multiplier_multi, ignored_by, persists_through_switch, prevents, source
- 例: {"kind":"壁設置","value":"ひかりのかべ","target":"team","phase":"lasting","duration":5,"reduces":["special_damage"],"multiplier":0.5,"multiplier_multi":0.6667,"ignored_by":["critical_hit"],"persists_through_switch":true}

### 特性上書き (本番4件)
- fields: kind, target, phase, source, exceptions, value
- 例: {"kind":"特性上書き","target":"self","phase":"on_use","source":"opponent_ability","exceptions":[{"type":"ability","reason":"certain unique abilities cannot be copied","values":["ふしぎなまもり"],"complete":false,"needs_research":true}]}

### 壁除去 (本番4件)
- fields: kind, target, phase, values
- 例: {"kind":"壁除去","target":"opponent_team","phase":"on_use","values":["リフレクター","ひかりのかべ","オーロラベール"]}

### 技タイプ変更 (本番4件)
- fields: kind, target, phase, mapping, default_type, condition, type_by_form, values
- 例: {"kind":"技タイプ変更","target":"self","phase":"on_use","mapping":{"にほんばれ":"ほのお","あめ":"みず","ゆき":"こおり","すなあらし":"いわ"},"default_type":"ノーマル"}

### まもり貫通 (本番4件)
- fields: kind, target, phase, pierces_without_removing, values, user_takes_fraction, bypasses, not_bypassed
- 例: {"kind":"まもり貫通","target":"opponent","phase":"on_use","pierces_without_removing":["ダイウォール"]}

### 条件威力倍率 (本番4件)
- fields: kind, target, phase, multiplier, condition, prob
- 例: {"kind":"条件威力倍率","target":"opponent","phase":"on_use","multiplier":2,"condition":{"type":"user_moves_after_target"}}

### 能力入替 (本番4件)
- fields: kind, target, stats, phase, note, effect, detail, targets
- 例: {"kind":"能力入替","target":"self","stats":["attack","defense"],"phase":"on_use","note":"実際の『こうげき』と『ぼうぎょ』の数値を入れかえる(ランクは変わらない)"}

### フィールド展開 (本番4件)
- fields: kind, target, phase, value, duration
- 例: {"kind":"フィールド展開","target":"field","phase":"lasting","value":"グラスフィールド","duration":5}

### 天候必中 (本番3件)
- fields: kind, target, phase, value, accuracy, cases
- 例: {"kind":"天候必中","target":"all_opponents","phase":"on_use","value":"ゆき","accuracy":"never_miss"}

### 失敗ダメージ (本番3件)
- fields: kind, target, phase, fraction
- 例: {"kind":"失敗ダメージ","target":"self","phase":"on_use","fraction":0.5}

### 継続削り (本番3件)
- fields: kind, target, phase, fraction, condition, of, source
- 例: {"kind":"継続削り","target":"opponent","phase":"turn_end","fraction":0.25,"condition":{"type":"target_has_status","value":"のろい"}}

### 拘束 (本番3件)
- fields: kind, target, phase, duration, immune, prevents_switch
- 例: {"kind":"拘束","target":"opponent","phase":"lasting","duration":"自分が場を離れるまで","immune":[{"type":"target_type","value":"ゴースト"}],"prevents_switch":true}

### 状態異常予防 (本番3件)
- fields: kind, target, phase, value, duration, note, condition, values
- 例: {"kind":"状態異常予防","target":"all","phase":"lasting","value":"ねむり","duration":3,"note":"あばれている間、場のどのポケモンも眠れなくなる"}

### フィールド除去 (本番3件)
- fields: kind, target, phase, values, since_generation
- 例: {"kind":"フィールド除去","target":"field","phase":"on_use","values":["エレキフィールド","グラスフィールド","サイコフィールド","ミストフィールド"],"since_generation":8}

### 木の実強制 (本番3件)
- fields: kind, target, phase, value, condition
- 例: {"kind":"木の実強制","target":"opponent","phase":"on_use","value":"steal the target's held Berry and immediately use it on self for its effect","condition":{"type":"target_holds_battle_effect_berry"}}

### タイプ上書き (本番3件)
- fields: kind, target, phase, value, note, duration
- 例: {"kind":"タイプ上書き","target":"opponent","phase":"on_use","value":"みず"}

### 強制交代(吹き飛ばし) (本番2件)
- fields: kind, target, phase, ignores_accuracy, bypasses_substitute, replacement
- 例: {"kind":"強制交代(吹き飛ばし)","target":"opponent","phase":"on_use","ignores_accuracy":true,"bypasses_substitute":true,"replacement":"ランダム"}

### 持ち物奪取 (本番2件)
- fields: kind, target, phase, returned_after_trainer_battle, can_steal_when_own_item_knocked_off, returns_after_battle_vs_trainer, overwrites_if
- 例: {"kind":"持ち物奪取","target":"opponent","phase":"on_use","returned_after_trainer_battle":true,"can_steal_when_own_item_knocked_off":true}

### PP減少 (本番2件)
- fields: kind, target, phase, value, applies_to, amount, which_move
- 例: {"kind":"PP減少","target":"opponent","phase":"on_use","value":4,"applies_to":"target's last-used move"}

### たくわえ消費 (本番2件)
- fields: kind, target, phase, stats, note
- 例: {"kind":"たくわえ消費","target":"self","phase":"on_use","stats":["defense","special_defense"],"note":"『たくわえる』で上がった『ぼうぎょ』『とくぼう』を元に戻し、たくわえた数を0にする"}

### 引き寄せ (本番2件)
- fields: kind, target, phase, exceptions, battle_format, excludes_move_targets
- 例: {"kind":"引き寄せ","target":"self","phase":"this_turn","exceptions":[{"type":"move_target","values":["全体技 (spread/all-target moves)"],"effect":"not redirected"}],"battle_format":"double"}

### 持ち物交換 (本番2件)
- fields: kind, target, phase, between, note, detail
- 例: {"kind":"持ち物交換","target":"opponent","phase":"on_use","between":["self","opponent"],"note":"どちらか一方しか道具を持っていなくても成功する"}

### 自分拘束 (本番2件)
- fields: kind, target, phase, duration
- 例: {"kind":"自分拘束","target":"self","phase":"lasting","duration":"消えるまで"}

### 持ち物排除 (本番2件)
- fields: kind, target, phase, condition, restored_after_battle, mode
- 例: {"kind":"持ち物排除","target":"opponent","phase":"on_use","condition":{"type":"target_holding_item"},"restored_after_battle":true}

### 実数値折半 (本番2件)
- fields: kind, target, phase, stats, detail
- 例: {"kind":"実数値折半","target":"opponent","phase":"on_use","stats":["defense","special_defense"],"detail":"自分と相手の『ぼうぎょ』の実数値を合計して半分ずつにする。『とくぼう』も同じ"}

### 部屋系 (本番2件)
- fields: kind, target, phase, duration, effect, swap_stats, toggles_off_if, toggle
- 例: {"kind":"部屋系","target":"field","phase":"lasting","duration":5,"effect":"場の全員の『ぼうぎょ』と『とくぼう』が入れかわる","swap_stats":["defense","special_defense"],"toggles_off_if":"used again while already active"}

### 必ず急所 (本番2件)
- fields: kind, target, phase
- 例: {"kind":"必ず急所","target":"opponent","phase":"on_use"}

### 強制交代(攻撃) (本番2件)
- fields: kind, target, phase, replacement, no_switch_if_target_dynamax
- 例: {"kind":"強制交代(攻撃)","target":"opponent","phase":"on_use","replacement":"ランダム","no_switch_if_target_dynamax":true}

### ランク無視 (本番2件)
- fields: kind, target, phase
- 例: {"kind":"ランク無視","target":"opponent","phase":"on_use"}

### タイプ追加 (本番2件)
- fields: kind, target, phase, value
- 例: {"kind":"タイプ追加","target":"opponent","phase":"on_use","value":"くさ"}

### かなしばり (本番1件)
- fields: kind, target, phase, duration, move
- 例: {"kind":"かなしばり","target":"opponent","phase":"lasting","duration":4,"move":"target's last-used move"}

### やどりぎ (本番1件)
- fields: kind, target, phase, duration, fraction, of, heals, carries_over_on_user_switch
- 例: {"kind":"やどりぎ","target":"opponent","phase":"lasting","duration":"相手が場を離れるまで","fraction":0.125,"of":"target_max_hp","heals":"user","carries_over_on_user_switch":true}

### へんしん (本番1件)
- fields: kind, target, phase, duration, copies, not_copied, copied_move_pp, notes
- 例: {"kind":"へんしん","target":"self","phase":"lasting","duration":"自分が場を離れるまで","copies":["species","graphics","stats","ivs","stat_ranks","ability","moves"],"not_copied":["hp","held_item","status_condition"],"copied_move_pp":5,"notes":"copies the pre-Dynamax form if the target is Dynamaxed"}

### みがわり設置 (本番1件)
- fields: kind, target, phase, duration, hp, absorbs, blocks_status, bypassed_by_sound_moves, blocks_dynamax_moves, removed_if
- 例: {"kind":"みがわり設置","target":"self","phase":"lasting","duration":"こわれるまで","hp":"equal to HP lost (1/4 max HP)","absorbs":"all attacks until its HP reaches 0","blocks_status":true,"bypassed_by_sound_moves":true,"blocks_dynamax_moves":true,"removed_if":"user Dynamaxes"}

### みちづれ (本番1件)
- fields: kind, target, phase, duration, effect
- 例: {"kind":"みちづれ","target":"self","phase":"lasting","duration":1,"effect":"自分が次に行動する前に相手の技でひんしになったら、その相手も道連れでひんしになる"}

### ほろびのうた (本番1件)
- fields: kind, target, phase, duration, effect, applies_to, ends_if
- 例: {"kind":"ほろびのうた","target":"all","phase":"lasting","duration":3,"effect":"使った時に場にいた全員が、3ターン後にひんしになる(カウント 3→2→1→ひんし)","applies_to":"all Pokemon on the field when the move was used, including the user","ends_if":"an affected Pokemon switches out (counter resets/clears for that Pokemon)"}

### ロックオン (本番1件)
- fields: kind, target, phase, applies_on, effect
- 例: {"kind":"ロックオン","target":"opponent","phase":"delayed","applies_on":"next_turn","effect":"次にこの相手に使う技が、必ず当たる"}

### 能力倍率 (本番1件)
- fields: kind, target, stat, multiplier, phase, condition
- 例: {"kind":"能力倍率","target":"all","stat":"special_defense","multiplier":1.5,"phase":"lasting","condition":{"type":"type_in","values":["いわ"]}}

### 全体継続ダメージ (本番1件)
- fields: kind, target, phase, fraction, condition
- 例: {"kind":"全体継続ダメージ","target":"all","phase":"turn_end","fraction":0.0625,"condition":{"type":"not_type_in","values":["いわ","じめん","はがね"]}}

### こらえる (本番1件)
- fields: kind, target, phase
- 例: {"kind":"こらえる","target":"self","phase":"this_turn"}

### メロメロ付与 (本番1件)
- fields: kind, target, phase, effect, condition
- 例: {"kind":"メロメロ付与","target":"opponent","phase":"lasting","effect":"毎ターン50%の確率で、相手が行動できなくなる","condition":{"type":"opposite_gender"}}

### ランダム技 (本番1件)
- fields: kind, target, phase, pp_cost
- 例: {"kind":"ランダム技","target":"self","phase":"on_use","pp_cost":"this_move_only"}

### いたみわけ (本番1件)
- fields: kind, targets, phase, effect, dynamax_handling
- 例: {"kind":"いたみわけ","targets":["self","opponent"],"phase":"on_use","effect":"自分と相手の今のHPを合計して、半分ずつに分ける","dynamax_handling":"compute average on base HP, then apply the delta to current Dynamax HP"}

### アンコール (本番1件)
- fields: kind, target, phase, duration, effect, ends_if
- 例: {"kind":"アンコール","target":"opponent","phase":"lasting","duration":3,"effect":"相手は直前に使った技しか出せなくなる","ends_if":"that move's PP reaches 0"}

### ランクコピー (本番1件)
- fields: kind, target, phase, copies, onto
- 例: {"kind":"ランクコピー","target":"opponent","phase":"on_use","copies":"all stat ranks","onto":"self"}

### 遅延攻撃 (本番1件)
- fields: kind, target, phase, delay_turns, power, category, move_type, note, type_matchup_applies
- 例: {"kind":"遅延攻撃","target":"opponent","phase":"delayed","delay_turns":2,"power":120,"category":"special","move_type":"エスパー","note":"2ターン後に、その場所にいるポケモンに当たる。最初の相手が引っこんでいても当たる","type_matchup_applies":true}

### 連続強制(混乱なし) (本番1件)
- fields: kind, target, phase, duration
- 例: {"kind":"連続強制(混乱なし)","target":"self","phase":"lasting","duration":3}

### たくわえ加算 (本番1件)
- fields: kind, target, phase, value, max, note
- 例: {"kind":"たくわえ加算","target":"self","phase":"on_use","value":1,"max":3,"note":"『のみこむ』『はきだす』の効果が大きくなる"}

### いちゃもん (本番1件)
- fields: kind, target, phase, duration, effect
- 例: {"kind":"いちゃもん","target":"opponent","phase":"lasting","duration":"自分が場を離れるまで","effect":"相手は同じ技を続けて出せなくなる"}

### やけど低下無視 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"やけど低下無視","target":"self","phase":"on_use"}

### 次技威力倍化 (本番1件)
- fields: kind, target, phase, move_type, multiplier, uses, note
- 例: {"kind":"次技威力倍化","target":"self","phase":"lasting","move_type":"でんき","multiplier":2,"uses":1,"note":"でんきタイプの技を使うまで効果が続く"}

### ちょうはつ (本番1件)
- fields: kind, target, phase, duration, effect
- 例: {"kind":"ちょうはつ","target":"opponent","phase":"lasting","duration":3,"effect":"相手は変化技を出せなくなる"}

### 味方威力上昇 (本番1件)
- fields: kind, target, phase, multiplier
- 例: {"kind":"味方威力上昇","target":"ally","phase":"this_turn","multiplier":1.5}

### 地面技被弾化 (本番1件)
- fields: kind, target, phase, duration, condition
- 例: {"kind":"地面技被弾化","target":"self","phase":"lasting","duration":"消えるまで","condition":{"type":"any_of","values":["user_is_flying_type","user_ability_ふゆう"]}}

### 持ち物復活 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"持ち物復活","target":"self","phase":"on_use"}

### 特性交換 (本番1件)
- fields: kind, target, phase, exceptions
- 例: {"kind":"特性交換","target":"opponent","phase":"on_use","exceptions":[{"type":"ability","reason":"certain unique abilities cannot be swapped","values":["ふしぎなまもり"],"complete":false,"needs_research":true}]}

### ふういん (本番1件)
- fields: kind, target, phase, duration, effect
- 例: {"kind":"ふういん","target":"self","phase":"lasting","duration":"自分が場を離れるまで","effect":"自分も知っている技を、相手は使えなくなる"}

### 命中率固定 (本番1件)
- fields: kind, target, phase, value, condition, else_value, note
- 例: {"kind":"命中率固定","target":"self","phase":"on_use","value":30,"condition":{"type":"user_is_type","values":["こおり"]},"else_value":20,"note":"自分がこおりタイプなら命中30%、それ以外は20%"}

### タイプ一時無効 (本番1件)
- fields: kind, target, value, phase
- 例: {"kind":"タイプ一時無効","target":"self","value":"ひこう","phase":"this_turn"}

### じゅうりょく (本番1件)
- fields: kind, target, phase, duration, sub_effects
- 例: {"kind":"じゅうりょく","target":"field","phase":"lasting","duration":5,"sub_effects":["場の全員の命中率が5/3倍になる","ひこうタイプや特性『ふゆう』のポケモンも地面にいる扱いになる(じめん技が当たる)","空中にいる技(そらをとぶ/はねる/とびげり/とびひざげり/とびはねる/でんじふゆう/フライングプレス/フリーフォール)が使えなくなり、使用中なら中止される","『テレキネシス』を解除し、使えなくする","『Gのちから』の威力が1.5倍になる"]}

### まもり解除 (本番1件)
- fields: kind, target, phase, removes_protection, affected_moves
- 例: {"kind":"まもり解除","target":"opponent","phase":"on_use","removes_protection":true,"affected_moves":["まもる","みきり","たたみがえし","トーチカ","キングシールド","ニードルガード","ブロッキング","スレッドトラップ","かえんのまもり","ファストガード","ワイドガード"]}

### 木の実奪取食 (本番1件)
- fields: kind, target, phase, item_filter, applies_to_self
- 例: {"kind":"木の実奪取食","target":"opponent","phase":"on_use","item_filter":"battle-effective berry","applies_to_self":true}

### なげつける (本番1件)
- fields: kind, target, phase, power_and_effect, consumes_user_item, note, complete, needs_research
- 例: {"kind":"なげつける","target":"opponent","phase":"on_use","power_and_effect":"determined by user held item","consumes_user_item":true,"note":"持っている道具によって威力や追加効果が変わる(例: 状態異常のきのみはその効果、くろいてっきゅう等は決まった威力)","complete":false,"needs_research":true}

### 特性無効化 (本番1件)
- fields: kind, target, phase, exceptions
- 例: {"kind":"特性無効化","target":"opponent","phase":"on_use","exceptions":[{"type":"ability","reason":"form-related or certain unique abilities","values":["バトルスイッチ","ばけのかわ"],"complete":false,"needs_research":true}]}

### 直前技模倣 (本番1件)
- fields: kind, target, phase, note
- 例: {"kind":"直前技模倣","target":"self","phase":"on_use","note":"直前の技がダイマックスわざだった時は、元の技をまねする"}

### トリックルーム (本番1件)
- fields: kind, target, phase, duration, effect, toggle
- 例: {"kind":"トリックルーム","target":"field","phase":"lasting","duration":5,"effect":"『すばやさ』が低いポケモンから先に行動する","toggle":true}

### 範囲まもり (本番1件)
- fields: kind, target, phase, value, detail
- 例: {"kind":"範囲まもり","target":"team","phase":"this_turn","value":"ワイドガード","detail":"そのターン、複数を巻き込む技から自分と味方を守る"}

### 別防御参照ダメージ (本番1件)
- fields: kind, target, phase, value
- 例: {"kind":"別防御参照ダメージ","target":"opponent","phase":"on_use","value":"defense"}

### 相手能力ダメージ (本番1件)
- fields: kind, target, phase, stat
- 例: {"kind":"相手能力ダメージ","target":"opponent","phase":"on_use","stat":"attack"}

### 直後に行動 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"直後に行動","target":"opponent","phase":"this_turn"}

### 行動順繰上げ (本番1件)
- fields: kind, target, phase
- 例: {"kind":"行動順繰上げ","target":"ally","phase":"this_turn"}

### ランクリセット (本番1件)
- fields: kind, target, phase
- 例: {"kind":"ランクリセット","target":"opponent","phase":"on_use"}

### 位置入替 (本番1件)
- fields: kind, target, phase, consecutive_success_multiplier
- 例: {"kind":"位置入替","target":"ally","phase":"on_use","consecutive_success_multiplier":0.3333}

### 最後に行動 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"最後に行動","target":"opponent","phase":"this_turn"}

### 接触反動 (本番1件)
- fields: kind, target, phase, fraction, condition
- 例: {"kind":"接触反動","target":"opponent","phase":"this_turn","fraction":0.125,"condition":{"type":"contact_move"}}

### 技タイプ追加 (本番1件)
- fields: kind, target, phase, value
- 例: {"kind":"技タイプ追加","target":"self","phase":"on_use","value":"ひこう"}

### 相手技タイプ変更 (本番1件)
- fields: kind, target, value, phase, condition
- 例: {"kind":"相手技タイプ変更","target":"opponent","value":"でんき","phase":"this_turn","condition":{"type":"used_before_target_moves"}}

### 全員逃走不可 (本番1件)
- fields: kind, target, phase, duration, exceptions, immune
- 例: {"kind":"全員逃走不可","target":"all","phase":"lasting","duration":"次のターンの終わりまで","exceptions":[{"type":"has_type","value":"ゴースト"}],"immune":[{"type":"target_type","value":"ゴースト"}]}

### 相性上書き (本番1件)
- fields: kind, target, phase, against_type, effectiveness
- 例: {"kind":"相性上書き","target":"opponent","phase":"on_use","against_type":"みず","effectiveness":"super_effective"}

### 技強制再使用 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"技強制再使用","target":"opponent","phase":"on_use"}

### 優先技無効 (本番1件)
- fields: kind, target, phase, duration, source, condition, note
- 例: {"kind":"優先技無効","target":"all","phase":"lasting","duration":5,"source":"opponent","condition":{"type":"grounded"},"note":"味方の先制技は防がない"}

### ランク数威力加算 (本番1件)
- fields: kind, target, phase, add_per_stage
- 例: {"kind":"ランク数威力加算","target":"self","phase":"on_use","add_per_stage":20}

### タイプ除去 (本番1件)
- fields: kind, target, value, phase
- 例: {"kind":"タイプ除去","target":"self","value":"ほのお","phase":"on_use"}

### カテゴリ封じ (本番1件)
- fields: kind, target, phase, duration, category, blocked_moves
- 例: {"kind":"カテゴリ封じ","target":"opponent","phase":"lasting","duration":2,"category":"sound","blocked_moves":["いにしえのうた","いびき","いやしのすず","いやなおと","うたう","うたかたのアリア","エコーボイス","おしゃべり","おたけび","きんぞくおん","くさぶえ","さわぐ","スケイルノイズ","すてゼリフ","チャームボイス","ちょうおんぱ","とおぼえ","ないしょばなし","なきごえ","バークアウト","ハイパーボイス","ばくおんぱ","ほえる","ほろびのうた","むしのさざめき","りんしょう","ソウルビート","オーバードライブ","ぶきみなじゅもん","フレアソング","みわくのボイス","サイコノイズ"]}

### 別能力ダメージ (本番1件)
- fields: kind, target, phase, use_stat, instead_of, includes_stat_stages
- 例: {"kind":"別能力ダメージ","target":"self","phase":"on_use","use_stat":"defense","instead_of":"attack","includes_stat_stages":true}

### 対象範囲変更 (本番1件)
- fields: kind, target, phase, becomes, condition, spread_multiplier_in_doubles
- 例: {"kind":"対象範囲変更","target":"opponent_team","phase":"on_use","becomes":"all_opponents","condition":{"type":"field","value":"サイコフィールド","and":"user_grounded","grounded_exceptions":["ひこうタイプ","ふゆう"]},"spread_multiplier_in_doubles":0.75}

### 物理特殊自動 (本番1件)
- fields: kind, target, phase, rule
- 例: {"kind":"物理特殊自動","target":"self","phase":"on_use","rule":"compare Physical and Special damage, use the higher category"}

### 条件付き優先 (本番1件)
- fields: kind, target, phase, priority, condition
- 例: {"kind":"条件付き優先","target":"self","phase":"on_use","priority":1,"condition":{"type":"all","values":[{"type":"terrain","value":"グラスフィールド"},{"type":"user_grounded","not_negated_by":["ひこうタイプ","ふゆう"],"complete":false}]}}

### 相手持ち物威力 (本番1件)
- fields: kind, target, phase, negates_item
- 例: {"kind":"相手持ち物威力","target":"opponent","phase":"on_use","negates_item":false}

### 威力段階増加 (本番1件)
- fields: kind, target, phase, per, power_increment, scope
- 例: {"kind":"威力段階増加","target":"self","phase":"on_use","per":"fainted_teammate","power_increment":50,"scope":"team"}

### 拘束解除 (本番1件)
- fields: kind, target, phase, values
- 例: {"kind":"拘束解除","target":"self","phase":"on_use","values":["うずしお","からではさむ","サンダープリズン","しめつける","すなじごく","トラバサミ","ほのおのうず","マグマストーム","まきつく","やどりぎのタネ"]}

### 次ターン使用不可 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"次ターン使用不可","target":"self","phase":"on_use"}

### ランク反転 (本番1件)
- fields: kind, target, phase
- 例: {"kind":"ランク反転","target":"opponent","phase":"on_use"}
