// PchamDB オンライン対戦マネージャ(P1: 合言葉ルーム・ホスト権限リレー方式)
// 依存: Supabase JS (window.supabase) + online/supabase-config.js (window.PCHAM_SUPABASE)
//
// ★設計(設計_オンライン対戦_2026-07-07.md):
//   - 部屋 = Supabase Realtime channel。合言葉(ルームコード)が channel 名。
//   - 先に presence に載った人 = ホスト(エンジンを回す権威)。2人目 = ゲスト。
//   - メッセージは broadcast で相手へ。ホストだけ runTurn を回し、battleLog差分を配る。
//
// ★ゲーム(real_battle.html)との連携は window.RBHooks 経由(疎結合):
//   RBHooks = {
//     getTeamPayload(): 自分のチーム(saveTeamの形)を返す
//     applyOpponentTeam(payload): 相手チームを opp 側にセットして盤面初期化
//     onOpponentAction(action): ゲスト→ホスト。相手の行動{kind,moveIdx,switchIdx,mega}
//     runHostTurn(): ホストが両者の行動でrunTurn→battleLog差分[{phase,msg}]を返す
//     playTurnResult(log): 差分ログを say() で再生(ゲスト側/ホスト側共通)
//     onFaintReplace(benchIdx): 相手の死に出し選択
//     onPeerJoined(role) / onPeerLeft() / onStatus(text): UI通知
//     onResign(): 相手が降参
//   }
//
// ★公開API(real_battle.htmlから呼ぶ): window.RBOnline
//   RBOnline.connect(roomCode, displayName) -> Promise<{role}>
//   RBOnline.sendTeam() / sendAction(action) / sendTurnResult(log) / sendFaintReplace(idx) / resign()
//   RBOnline.disconnect()
//   RBOnline.role  ('host' | 'guest' | null)
//   RBOnline.connected (bool)

(function (global) {
  'use strict';

  var sb = null;        // supabase client
  var channel = null;   // realtime channel(=部屋)
  var state = {
    role: null,         // 'host' | 'guest'
    connected: false,
    roomCode: null,
    myId: null,         // このクライアントの一意ID(presence用)
    peerPresent: false,
    peerId: null,
  };

  function hooks() { return global.RBHooks || {}; }
  function log(msg) { try { (hooks().onStatus || function () {})(msg); } catch (e) {} }
  // UI文言はI18N(ui-*.json real_battle.online_*)経由。未ロード時はjaフォールバック
  function t(key, ja) { try { return (global.I18N && global.I18N.t) ? global.I18N.t('real_battle.' + key, ja) : ja; } catch (e) { return ja; } }

  // ランダムな匿名ID(presenceのキー)。localStorageに保持。
  function myClientId() {
    var k = 'rb_online_cid';
    var v = null;
    try { v = localStorage.getItem(k); } catch (e) {}
    if (!v) {
      v = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }

  function ensureClient() {
    if (sb) return sb;
    if (!global.supabase || !global.PCHAM_SUPABASE) {
      throw new Error('supabase-js または supabase-config.js が読み込まれていません');
    }
    sb = global.supabase.createClient(global.PCHAM_SUPABASE.url, global.PCHAM_SUPABASE.anonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    return sb;
  }

  // 合言葉ルームに接続。presenceで先着=ホストを決める。
  function connect(roomCode, displayName) {
    ensureClient();
    state.roomCode = String(roomCode || '').trim();
    state.myId = myClientId();
    if (!state.roomCode) return Promise.reject(new Error('合言葉が空です'));

    var chanName = 'pcham_room:' + state.roomCode;
    channel = sb.channel(chanName, {
      config: { presence: { key: state.myId }, broadcast: { self: false } },
    });

    // 相手からのメッセージ(broadcast)を受ける
    channel.on('broadcast', { event: 'msg' }, function (payload) {
      handleMessage(payload.payload || {});
    });

    // presenceで在室者を把握 → 先着(古いonline_at)がホスト
    channel.on('presence', { event: 'sync' }, function () {
      var st = channel.presenceState();
      assignRolesFromPresence(st);
    });

    return new Promise(function (resolve, reject) {
      channel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          channel.track({ id: state.myId, name: displayName || 'Player', online_at: Date.now() })
            .then(function () {
              state.connected = true;
              log(t('online_connected_waiting', '接続しました。相手を待っています…'));
              resolve({ role: state.role });
            });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('接続に失敗しました(' + status + ')'));
        }
      });
    });
  }

  // presence一覧から役割を決める。online_atが最小(先着)= host。
  // ★自分/相手の照合は presence の「キー」でなく track したペイロードの id で行う
  //   (supabase-js のバージョンによって presenceState のキーが myId と一致しないため)
  function assignRolesFromPresence(presenceState) {
    var byId = {};
    Object.keys(presenceState || {}).forEach(function (key) {
      var arr = presenceState[key];
      if (arr && arr[0] && arr[0].id) {
        var e = arr[0];
        // 同一idが複数(再接続)あれば online_at が小さい方を採用
        if (!byId[e.id] || (e.online_at || 0) < byId[e.id].at) byId[e.id] = { id: e.id, at: e.online_at || 0, name: e.name };
      }
    });
    var members = Object.keys(byId).map(function (k) { return byId[k]; });
    members.sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); });

    var prevRole = state.role;
    var meIdx = members.findIndex(function (m) { return m.id === state.myId; });
    state.role = (meIdx === 0) ? 'host' : (meIdx === 1 ? 'guest' : 'spectator');

    var peer = members.find(function (m) { return m.id !== state.myId; });
    var hadPeer = state.peerPresent;
    state.peerPresent = !!peer;
    state.peerId = peer ? peer.id : null;

    if (state.peerPresent && !hadPeer) {
      try { (hooks().onPeerJoined || function () {})(state.role, peer.name); } catch (e) {}
      log(t('online_peer_joined', '相手が入室しました: ') + (peer.name || ''));
    } else if (!state.peerPresent && hadPeer) {
      try { (hooks().onPeerLeft || function () {})(); } catch (e) {}
      log(t('online_peer_left', '相手が退出しました'));
    }
  }

  // 相手へ送る(broadcast)
  function send(type, data) {
    if (!channel) return;
    channel.send({ type: 'broadcast', event: 'msg', payload: Object.assign({ type: type, from: state.myId }, data || {}) });
  }

  // 受信したメッセージをゲームへ振り分け
  function handleMessage(m) {
    var h = hooks();
    switch (m.type) {
      case 'team':
        try { (h.applyOpponentTeam || function () {})(m.payload); } catch (e) {}
        break;
      case 'action':                       // ゲスト→ホスト(そのターンの行動)
        try { (h.onOpponentAction || function () {})(m.action); } catch (e) {}
        break;
      case 'turnGo':                       // ホスト→ゲスト(ホストの行動+乱数シード=ロックステップ開始合図)
        try { (h.onTurnGo || function () {})(m.action, m.seed, m.turn); } catch (e) {}
        break;
      case 'start':                        // ホスト→ゲスト(バトル開始+初期シード)
        try { (h.onStart || function () {})(m.seed); } catch (e) {}
        break;
      case 'ready':                        // 「チーム交換が済んで開始できる」の握手(レース防止)
        try { (h.onPeerReady || function () {})(); } catch (e) {}
        break;
      case 'turnResult':                   // (旧設計の互換用・現行ロックステップでは未使用)
        try { (h.playTurnResult || function () {})(m.log); } catch (e) {}
        break;
      case 'faintReplace':
        try { (h.onFaintReplace || function () {})(m.benchIdx, m.seed); } catch (e) {}
        break;
      case 'resign':
        try { (h.onResign || function () {})(); } catch (e) {}
        break;
      case 'ping':
        send('pong', {});
        break;
    }
  }

  function disconnect() {
    try { if (channel) { channel.untrack(); sb.removeChannel(channel); } } catch (e) {}
    channel = null;
    state.connected = false;
    state.role = null;
    state.peerPresent = false;
    state.peerId = null;
  }

  global.RBOnline = {
    connect: connect,
    disconnect: disconnect,
    sendTeam: function () { var h = hooks(); send('team', { payload: (h.getTeamPayload || function () { return null; })() }); },
    sendAction: function (action) { send('action', { action: action }); },
    sendTurnGo: function (action, seed, turn) { send('turnGo', { action: action, seed: seed, turn: turn }); },
    sendStart: function (seed) { send('start', { seed: seed }); },
    sendReady: function () { send('ready', {}); },
    sendTurnResult: function (logDiff) { send('turnResult', { log: logDiff }); },
    sendFaintReplace: function (benchIdx, seed) { send('faintReplace', { benchIdx: benchIdx, seed: seed }); },
    resign: function () { send('resign', {}); },
    ping: function () { send('ping', {}); },
    get role() { return state.role; },
    get connected() { return state.connected; },
    get peerPresent() { return state.peerPresent; },
    get roomCode() { return state.roomCode; },
  };
})(window);
