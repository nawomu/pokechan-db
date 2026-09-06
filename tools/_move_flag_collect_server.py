#!/usr/bin/env python3
"""Local-only intake for observed Yakkun flag tables. Never writes master.

Browser automation reads the real page, then pastes a batch into this local form.
Each move is keyed by its observed URL; replaying a batch replaces the same rows.
python3 tools/_move_flag_collect_server.py
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'review/_move_flag_audit_2026-09-06/sources/yakkun_ch.json'
LABELS = {'直接攻撃', 'まもる', 'マジックコート', 'みがわり', 'ゆびをふる', 'ねごと', 'まねっこ', 'さいはい'}


def merge_batch(records):
    if not isinstance(records, list) or not 1 <= len(records) <= 50:
        raise ValueError('batch must contain 1..50 rows')
    additions = {}
    for row in records:
        u = urlparse(row['url'])
        move_id = parse_qs(u.query).get('move', [''])[0]
        if u.scheme != 'https' or u.netloc != 'yakkun.com' or u.path != '/ch/zukan/search/' or not move_id.isdigit():
            raise ValueError('unexpected source URL')
        if set(row['flags']) != LABELS or not all(isinstance(v, str) and v for v in row['flags'].values()):
            raise ValueError('incomplete eight-cell table')
        if not row.get('title') or not row.get('raw_table'):
            raise ValueError('title and literal table required')
        additions[move_id] = {**row, 'move_no': int(move_id)}
    current = json.loads(OUT.read_text()) if OUT.exists() else {'source': 'Yakkun Champions rendered flag table', 'records': {}}
    current['records'].update(additions)
    current['updated_at'] = datetime.now(timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUT.with_suffix('.tmp')
    temp.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n')
    os.replace(temp, OUT)
    return len(current['records'])


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = '<!doctype html><meta charset="utf-8"><title>技フラグ根拠の保存</title><h1>技フラグ根拠の保存</h1><form method="post"><label>取得結果<textarea name="payload" rows="10" cols="90"></textarea></label><button>保存</button></form>'
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body.encode())

    def do_POST(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 1024 * 1024:
                raise ValueError('invalid payload length')
            data = parse_qs(self.rfile.read(size).decode())['payload'][0]
            count = merge_batch(json.loads(data))
            text = f'保存済み: {count} 技'
            status = 200
        except (ValueError, KeyError, TypeError) as e:
            text = str(e)
            status = 400
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(('<meta charset="utf-8"><p>' + text + '</p><a href="/">次の取得結果</a>').encode())


if __name__ == '__main__':
    print('Flag evidence intake: http://127.0.0.1:8766', flush=True)
    HTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
