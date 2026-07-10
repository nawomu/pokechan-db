// PchamDB オンライン対戦 Supabase接続設定
// このキーは「公開してよい anon/publishable キー」(ブラウザに埋め込む前提・GitHub Pagesで公開されて問題ない設計)。
// ★ service_role(secret)キーはここに絶対置かない。
window.PCHAM_SUPABASE = {
  url: 'https://yznayflwjbxcstfkzqnv.supabase.co',
  // 合言葉/ロビー/対戦の Realtime に使う anon キー(公開安全)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bmF5Zmx3amJ4Y3N0Zmt6cW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTY2MjYsImV4cCI6MjA5MjIzMjYyNn0.FtIvxT7SG9zKq2AATTwbthiiVmUxk7BscPUK0U-Nw_c',
};
