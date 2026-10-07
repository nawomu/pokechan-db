'use strict';
// Presentation only: current facts and entity records come from the shared PokeDB.
(function () {
  function put(id, key, values) {
    const el = document.getElementById(id);
    if (!el) return;
    let text = I18N.t('currentInfo.' + key);
    Object.keys(values || {}).forEach(k => { text = text.replaceAll('{' + k + '}', String(values[k])); });
    el.textContent = text;
  }
  function names(ids, kind) {
    return ids.map(id => {
      const entry = (kind === 'pokemon' ? PokeDB.allPokemon() : PokeDB.items()).find(x => x.slug === id);
      if (!entry) throw new Error('Unknown current-info reference: ' + id);
      return kind === 'pokemon' ? I18N.pokemon(entry.name) : I18N.item(entry.name);
    }).join(' / ');
  }
  async function render() {
    if (!window.PokeDB || !window.I18N) return;
    try {
      await PokeDB.ready;
      await new Promise(resolve => I18N.onReady(resolve));
      const reg = PokeDB.regulation();
      if (reg) {
        put('current-reg-note', 'regulation_period', {reg:reg.id,start:reg.start_jst,end:reg.end_jst});
        const season = reg.ranked_season;
        const card = document.getElementById('news-current-season');
        if (season && card) {
          put('current-season-title', 'season_title', {season:season.id});
          document.getElementById('current-season-period').textContent = season.start_jst + ' – ' + season.end_jst + ' (JST)';
          put('current-season-rules', 'season_rules', {reg:reg.id,start:reg.start_jst,end:reg.end_jst});
          put('current-season-unlock', 'season_unlock', {date:season.upper_ranks_unlock_jst});
          const pass = season.battle_pass;
          put('current-season-pass', 'season_pass', {pokemon:names(pass.standard.pokemon,'pokemon'),vp:pass.standard.vp});
          put('current-season-premium', 'season_premium', {pokemon:names(pass.premium.pokemon,'pokemon'),items:names(pass.premium.items,'items')});
          document.getElementById('current-season-source').href = season.source_url;
          document.getElementById('current-pass-source').href = pass.source_url;
          card.hidden = false;
        }
      }
      if (document.getElementById('priority-example')) {
        const attacker = PokeDB.allPokemon().find(x => x.slug === 'metagross'), defender = PokeDB.allPokemon().find(x => x.slug === 'noivern');
        const move = PokeDB.move('bullet-punch');
        const learned = PokeDB.learnset(attacker.name);
        if (!learned || !learned.includes(move.name)) throw new Error('Guide example is not currently learnable');
        const values = {attacker:I18N.pokemon(attacker.name),defender:I18N.pokemon(defender.name),move:I18N.move(move.champions_key || move.slug,move.name),priority:'+'+move.priority};
        put('priority-example-setup','priority_example',values);
        put('priority-example-result','priority_result',values);
      }
    } catch (error) { PokeDB.showLoadError(error); }
  }
  document.addEventListener('i18n:ready',render);
  document.addEventListener('i18n:changed',render);
  render();
})();
