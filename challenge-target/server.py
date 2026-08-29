import html
import json
import os
import socketserver
import sqlite3
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HTTP_HOST = os.environ.get("CHALLENGE_HTTP_HOST", "0.0.0.0")
HTTP_PORT = int(os.environ.get("CHALLENGE_HTTP_PORT", "3100"))
TCP_HOST = os.environ.get("CHALLENGE_TCP_HOST", HTTP_HOST)
TCP_PORT = int(os.environ.get("CHALLENGE_TCP_PORT", "4100"))

FLAGS = {
    "burp": "TBX{burp_repeater_2026}",
    "gobuster": "TBX{gobuster_hidden_backup}",
    "nikto": "TBX{nikto_server_status}",
    "sqlmap": "TBX{sqlmap_sqlite_inventory}",
    "hydra": "TBX{hydra_bounded_login}",
    "netcat": "TBX{netcat_line_protocol}",
    "metasploit": "TBX{metasploit_auxiliary_scan}",
}

db_lock = threading.Lock()
database = None


def reset_database():
    global database
    with db_lock:
        if database is not None:
            database.close()
        database = sqlite3.connect(":memory:", check_same_thread=False)
        database.executescript(
            """
            CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, description TEXT);
            CREATE TABLE secrets (id INTEGER PRIMARY KEY, label TEXT, value TEXT);
            INSERT INTO products(name, description) VALUES
              ('apple', 'Aomori apple'), ('orange', 'Ehime orange'), ('melon', 'Hokkaido melon');
            """
        )
        database.execute(
            "INSERT INTO secrets(label, value) VALUES (?, ?)",
            ("training_flag", FLAGS["sqlmap"]),
        )
        database.commit()


reset_database()


def page(title, body):
    return f"""<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{html.escape(title)}</title>
<style>
:root{{--bg:#05070a;--panel:#0c1117;--panel-2:#101821;--line:#253443;--text:#d8e7f2;--muted:#8293a3;--cyan:#55f5d2;--violet:#9b7cff}}
*{{box-sizing:border-box}}html{{min-height:100%;background:var(--bg)}}
body{{min-height:100vh;margin:0;padding:42px 22px 70px;color:var(--text);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:radial-gradient(circle at 78% 12%,rgba(155,124,255,.13),transparent 30%),radial-gradient(circle at 12% 85%,rgba(85,245,210,.09),transparent 32%),linear-gradient(rgba(85,245,210,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(85,245,210,.025) 1px,transparent 1px),var(--bg);background-size:auto,auto,30px 30px,30px 30px,auto}}
body::before{{content:'TERMINALBOX // ISOLATED SECURITY LAB';display:block;max-width:920px;margin:0 auto 14px;color:var(--cyan);font-size:11px;letter-spacing:.22em;text-transform:uppercase}}
nav,h1,body>.card{{width:min(920px,100%);margin-left:auto;margin-right:auto}}
nav{{display:flex;flex-wrap:wrap;gap:8px;padding:10px;border:1px solid var(--line);border-radius:8px;background:rgba(12,17,23,.88);box-shadow:0 18px 70px rgba(0,0,0,.38)}}
nav a{{padding:9px 13px;border:1px solid transparent;border-radius:5px;color:var(--muted);font-size:12px;text-decoration:none;transition:.18s ease}}
nav a:hover{{color:var(--cyan);border-color:rgba(85,245,210,.35);background:rgba(85,245,210,.06)}}
h1{{margin-top:44px;margin-bottom:20px;color:#f1f7fb;font-size:clamp(24px,5vw,42px);line-height:1.15;letter-spacing:-.04em;text-shadow:0 0 32px rgba(85,245,210,.13)}}
h1::before{{content:'> ';color:var(--cyan)}}
.card{{position:relative;overflow:hidden;padding:28px;border:1px solid var(--line);border-radius:10px;background:linear-gradient(145deg,rgba(16,24,33,.97),rgba(8,12,17,.97));box-shadow:0 24px 80px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.025)}}
.card::before{{content:'';position:absolute;top:0;left:0;width:100%;height:2px;background:linear-gradient(90deg,var(--cyan),var(--violet),transparent)}}
p{{color:#aebdca;line-height:1.75}}label{{display:grid;gap:7px;color:var(--muted);font-size:12px}}form{{display:grid;gap:16px;max-width:520px}}
input,button{{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:5px;color:var(--text);background:#070b0f;font:inherit}}
input:focus{{outline:none;border-color:var(--cyan);box-shadow:0 0 0 3px rgba(85,245,210,.08)}}
button{{cursor:pointer;border-color:rgba(85,245,210,.48);color:#07110f;background:var(--cyan);font-weight:700;letter-spacing:.04em;transition:.18s ease}}
button:hover{{filter:brightness(1.08);box-shadow:0 0 24px rgba(85,245,210,.18)}}
code{{padding:3px 7px;border:1px solid rgba(155,124,255,.3);border-radius:4px;color:#c8baff;background:rgba(155,124,255,.08)}}
@media(max-width:560px){{body{{padding:24px 14px 50px}}h1{{margin-top:30px}}.card{{padding:21px}}}}
</style></head>
<body><nav><a href=\"/\">Tool Lab</a><a href=\"/burp/\">Burp</a><a href=\"/sql/\">SQL</a><a href=\"/hydra/\">Login</a></nav>
<h1>{html.escape(title)}</h1>{body}</body></html>"""


class ChallengeHandler(BaseHTTPRequestHandler):
    server_version = "TerminalBox-Legacy/0.8"

    def log_message(self, fmt, *args):
        print(f"challenge-http {self.address_string()} {fmt % args}", flush=True)

    def send_bytes(self, status, payload, content_type="text/html; charset=utf-8", headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(payload if isinstance(payload, bytes) else payload.encode("utf-8"))

    def send_json(self, status, payload, headers=None):
        self.send_bytes(status, json.dumps(payload, ensure_ascii=False), "application/json; charset=utf-8", headers)

    def form(self):
        length = min(int(self.headers.get("content-length", "0") or "0"), 8192)
        return urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8", "replace"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/status":
            self.send_json(200, {"status": "ok", "service": "terminalbox-challenge-target"})
        elif path == "/":
            self.send_bytes(200, page("TerminalBox Security Tool Lab", "<div class=\"card\"><p>隔離された演習用ターゲットです。</p><p>許可されたTerminalBox内からのみ使用してください。</p></div>"))
        elif path == "/robots.txt":
            self.send_bytes(200, "User-agent: *\nDisallow: /internal-backup/\nDisallow: /server-status\n", "text/plain; charset=utf-8")
        elif path == "/internal-backup/flag.txt":
            self.send_bytes(200, FLAGS["gobuster"] + "\n", "text/plain; charset=utf-8")
        elif path in ("/internal-backup", "/internal-backup/"):
            self.send_bytes(200, "backup index: flag.txt\n", "text/plain; charset=utf-8")
        elif path == "/server-status":
            self.send_bytes(200, f"Training server status: enabled\nFlag: {FLAGS['nikto']}\n", "text/plain; charset=utf-8")
        elif path == "/burp/":
            body = """<div class=\"card\"><p>社内研修の割引申請です。送信リクエストをBurp Proxyで捕捉し、<code>discount</code>を調査してください。</p>
<form method=\"post\" action=\"/burp/apply\"><label>社員番号<input name=\"employee\" value=\"student\"></label>
<input type=\"hidden\" name=\"discount\" value=\"10\"><button type=\"submit\">10%割引を申請</button></form></div>"""
            self.send_bytes(200, page("Burp Suite演習", body))
        elif path == "/sql/":
            body = """<div class=\"card\"><form method=\"get\" action=\"/sql/search\"><label>商品検索<input name=\"q\" value=\"apple\"></label><button>検索</button></form></div>"""
            self.send_bytes(200, page("商品検索API", body))
        elif path == "/sql/search":
            query = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            sql = f"SELECT id, name, description FROM products WHERE name LIKE '%{query}%'"
            try:
                with db_lock:
                    columns = [item[0] for item in database.execute(sql).description]
                    rows = [dict(zip(columns, row)) for row in database.execute(sql).fetchall()]
                self.send_json(200, {"query": query, "results": rows})
            except sqlite3.Error as error:
                self.send_json(500, {"error": f"SQLite error: {error}"})
        elif path == "/hydra/":
            body = """<div class=\"card\"><form method=\"post\" action=\"/hydra/login\"><label>User<input name=\"username\"></label>
<label>Password<input type=\"password\" name=\"password\"></label><button>Login</button></form></div>"""
            self.send_bytes(200, page("Training Login", body))
        elif path == "/metasploit/status":
            if self.headers.get("X-TerminalBox-Msf") == "auxiliary-scan":
                self.send_json(200, {"service": "terminalbox-module-target", "flag": FLAGS["metasploit"]})
            else:
                self.send_json(403, {"error": "scanner header required"})
        else:
            self.send_json(404, {"error": "not_found", "path": path})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/lab/reset":
            reset_database()
            self.send_json(200, {"status": "reset"})
        elif path == "/burp/apply":
            values = self.form()
            employee = values.get("employee", [""])[0]
            discount = values.get("discount", [""])[0]
            if employee == "student" and discount == "90":
                self.send_bytes(200, page("申請承認", f"<div class=\"card\"><p>管理者割引が適用されました。</p><code>{FLAGS['burp']}</code></div>"))
            else:
                self.send_bytes(200, page("申請結果", "<div class=\"card\"><p>通常割引を受け付けました。リクエストを詳しく確認してください。</p></div>"))
        elif path == "/hydra/login":
            values = self.form()
            if values.get("username", [""])[0] == "analyst" and values.get("password", [""])[0] == "bluebird":
                self.send_bytes(200, f"Login successful\nFlag: {FLAGS['hydra']}\n", "text/plain; charset=utf-8")
            else:
                # Hydra's http-post-form module treats 401 as HTTP authentication.
                # Keep form failures at 200 and let its failure marker identify them.
                self.send_bytes(200, "Invalid credentials\n", "text/plain; charset=utf-8")
        else:
            self.send_json(404, {"error": "not_found", "path": path})

    def do_OPTIONS(self):
        self.send_bytes(200, "GET, POST, OPTIONS, TRACE\n", "text/plain; charset=utf-8", {"Allow": "GET, POST, OPTIONS, TRACE"})

    def do_TRACE(self):
        self.send_bytes(200, self.requestline + "\n", "message/http")


class TcpChallengeHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b"TerminalBox line protocol v1\nSend: FLAG PLEASE\n")
        self.wfile.flush()
        line = self.rfile.readline(128).decode("utf-8", "replace").strip().upper()
        if line == "FLAG PLEASE":
            self.wfile.write((FLAGS["netcat"] + "\n").encode())
        else:
            self.wfile.write(b"ERR expected FLAG PLEASE\n")


class ReusableTcpServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    tcp_server = ReusableTcpServer((TCP_HOST, TCP_PORT), TcpChallengeHandler)
    threading.Thread(target=tcp_server.serve_forever, daemon=True).start()
    print(f"challenge TCP listening on {TCP_HOST}:{TCP_PORT}", flush=True)
    http_server = ThreadingHTTPServer((HTTP_HOST, HTTP_PORT), ChallengeHandler)
    print(f"challenge HTTP listening on {HTTP_HOST}:{HTTP_PORT}", flush=True)
    http_server.serve_forever()
