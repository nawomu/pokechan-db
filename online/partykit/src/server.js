// PchamDB オンライン対戦 リレーサーバー(P1: 合言葉ルーム / ホスト権限リレー方式)
//
// 役割: このサーバーはゲームの計算を一切しない「中継役」だけ。
//   - 部屋(room) = 合言葉(ルームコード)。PartyKit では room id がそのまま部屋になる。
//   - 最初に入った人 = ホスト(host)。エンジンを回す権威。
//   - 2人目 = ゲスト(guest)。エンジンは回さず、送られてきた battleLog を再生するだけ。
//   - 3人目以降 = 満室で拒否。
//   - メッセージは相手にそのまま転送するだけ(team / action / turnResult / faintReplace / ping 等)。
//
// 設計根拠: 設計_オンライン対戦_2026-07-07.md(ホスト権限リレー方式=乱数はホストのみが持つ)。

export default class BattleRoom {
  constructor(room) {
    this.room = room;      // PartyKit の Room(= 1部屋 = 1 Durable Object)
    this.hostId = null;    // ホストの接続id
    this.guestId = null;   // ゲストの接続id
  }

  // 現在つながっている接続一覧
  _conns() {
    return [...this.room.getConnections()];
  }

  _roleOf(id) {
    if (id === this.hostId) return 'host';
    if (id === this.guestId) return 'guest';
    return null;
  }

  _send(conn, obj) {
    try { conn.send(JSON.stringify(obj)); } catch (_) {}
  }

  _broadcastExcept(senderId, raw) {
    for (const c of this._conns()) {
      if (c.id !== senderId) {
        try { c.send(raw); } catch (_) {}
      }
    }
  }

  onConnect(conn) {
    // 既に host も guest も埋まっていて、この接続がどちらでもない = 満室
    const already = this._conns().filter(c => c.id !== conn.id).length;
    if (this.hostId && this.guestId && conn.id !== this.hostId && conn.id !== this.guestId) {
      this._send(conn, { type: 'room_full' });
      try { conn.close(); } catch (_) {}
      return;
    }

    // 役割の割り当て(先着=ホスト)
    let role;
    if (!this.hostId) { this.hostId = conn.id; role = 'host'; }
    else if (!this.guestId) { this.guestId = conn.id; role = 'guest'; }
    else { role = this._roleOf(conn.id) || 'spectator'; }

    // 本人へ: あなたの役割 + 相手が既にいるか
    const peerPresent = (role === 'host') ? !!this.guestId : !!this.hostId;
    this._send(conn, { type: 'welcome', role, room: this.room.id, peerPresent });

    // 相手へ: 誰か入ってきた(両者そろった合図)
    this._broadcastExcept(conn.id, JSON.stringify({ type: 'peer_joined', role }));
  }

  // 受信メッセージは相手へそのまま転送(サーバーは中身を解釈しない=ホスト権限)
  onMessage(message, sender) {
    // message は文字列(JSON)。壊れていても素通しはしない。
    let ok = true;
    if (typeof message === 'string') {
      // ping は presence 用に軽く握り返してもよいが、基本は転送のみ
      this._broadcastExcept(sender.id, message);
    } else {
      ok = false;
    }
    if (!ok) this._send(sender, { type: 'error', reason: 'bad_message' });
  }

  onClose(conn) {
    const role = this._roleOf(conn.id);
    if (conn.id === this.hostId) this.hostId = null;
    if (conn.id === this.guestId) this.guestId = null;
    // 残っている相手へ切断通知
    this._broadcastExcept(conn.id, JSON.stringify({ type: 'peer_left', role }));
  }

  onError(conn) {
    this.onClose(conn);
  }
}
