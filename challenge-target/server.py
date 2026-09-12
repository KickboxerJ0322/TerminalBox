import base64
import html
import json
import os
import re
import secrets
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
    "web_parameter": "TBX{web_parameter_tampering}",
    "web_idor": "TBX{web_idor_profile}",
    "web_sqli": "TBX{web_sqli_basic}",
    "web_xss": "TBX{web_stored_xss}",
    "web_traversal": "TBX{web_path_traversal}",
    "web_upload": "TBX{web_file_upload}",
    "web_ssrf": "TBX{web_ssrf_internal}",
    "web_jwt": "TBX{web_jwt_admin}",
}

db_lock = threading.Lock()
database = None
market_token_nonce = ""
market_token_nonces = {}
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
DEFAULT_SESSION_ID = "anonymous"


def reset_database():
    global database, market_token_nonce, market_token_nonces
    with db_lock:
        if database is not None:
            database.close()
        database = sqlite3.connect(":memory:", check_same_thread=False)
        database.executescript(
            """
            CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, description TEXT);
            CREATE TABLE secrets (id INTEGER PRIMARY KEY, label TEXT, value TEXT);
            CREATE TABLE market_products (id INTEGER PRIMARY KEY, name TEXT, description TEXT, price INTEGER);
            CREATE TABLE training_secrets (id INTEGER PRIMARY KEY, label TEXT, value TEXT);
            CREATE TABLE market_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, author TEXT, body TEXT);
            CREATE TABLE market_uploads (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, filename TEXT, content_type TEXT, size INTEGER);
            INSERT INTO products(name, description) VALUES
              ('apple', 'Aomori apple'), ('orange', 'Ehime orange'), ('melon', 'Hokkaido melon');
            """
        )
        database.executemany(
            "INSERT INTO market_products(id, name, description, price) VALUES (?, ?, ?, ?)",
            [
                (1, "TBX Note C Stand", "Lightweight stand for training desks", 3200),
                (2, "USB Security Key", "Training authentication device", 4800),
                (3, "Network Starter Guide", "Beginner guide for lab users", 2400),
                (4, "Apple USB Cable", "Accessory for learning devices", 1800),
            ],
        )
        database.execute(
            "INSERT INTO secrets(label, value) VALUES (?, ?)",
            ("training_flag", FLAGS["sqlmap"]),
        )
        database.execute(
            "INSERT INTO training_secrets(label, value) VALUES (?, ?)",
            ("market_training_flag", FLAGS["web_sqli"]),
        )
        database.execute(
            "INSERT INTO market_comments(session_id, author, body) VALUES (?, ?, ?)",
            (DEFAULT_SESSION_ID, "TBX Market operator", "Welcome to TBX Market."),
        )
        database.commit()
        market_token_nonce = secrets.token_urlsafe(9)
        market_token_nonces = {DEFAULT_SESSION_ID: market_token_nonce}


reset_database()


def seed_session_state(session_id):
    with db_lock:
        if session_id not in market_token_nonces:
            market_token_nonces[session_id] = secrets.token_urlsafe(9)
        exists = database.execute(
            "SELECT 1 FROM market_comments WHERE session_id = ? LIMIT 1",
            (session_id,),
        ).fetchone()
        if exists:
            return
        database.execute(
            "INSERT INTO market_comments(session_id, author, body) VALUES (?, ?, ?)",
            (session_id, "TBX Market operator", "Welcome to TBX Market."),
        )
        database.commit()


def reset_session_state(session_id):
    with db_lock:
        market_token_nonces[session_id] = secrets.token_urlsafe(9)
        database.execute("DELETE FROM market_comments WHERE session_id = ?", (session_id,))
        database.execute("DELETE FROM market_uploads WHERE session_id = ?", (session_id,))
        database.execute(
            "INSERT INTO market_comments(session_id, author, body) VALUES (?, ?, ?)",
            (session_id, "TBX Market operator", "Welcome to TBX Market."),
        )
        database.commit()


def market_nonce_for_session(session_id):
    with db_lock:
        if session_id not in market_token_nonces:
            market_token_nonces[session_id] = secrets.token_urlsafe(9)
        return market_token_nonces[session_id]

TOOL_PREFIX = "/tool-target"


def normalize_path(path):
    if path == TOOL_PREFIX:
        return "/"
    if path.startswith(TOOL_PREFIX + "/"):
        return path[len(TOOL_PREFIX):]
    return path


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
<body><nav><a href=\"/tool-target/\">Tool Lab</a><a href=\"/tool-target/burp/\">Burp</a><a href=\"/tool-target/sql/\">SQL</a><a href=\"/tool-target/hydra/\">Login</a></nav>
<h1>{html.escape(title)}</h1>{body}</body></html>"""


MARKET_PREFIX = "/tool-target/web-attacks"
MARKET_PUBLIC_FILES = {
    "manual.txt": "TBX Market 縺泌茜逕ｨ繧ｬ繧､繝噂n蝠・刀雉ｼ蜈･縺ｨ繝励Ο繝輔ぅ繝ｼ繝ｫ邂｡逅・・謇矩・〒縺吶・n",
    "shipping.txt": "騾壼ｸｸ驟埼√・3蝟ｶ讌ｭ譌･莉･蜀・〒縺吶・n",
}
MARKET_PRIVATE_FILES = {
    "private/training-note.txt": f"遉ｾ蜀・比ｿｮ繝｡繝｢\n{FLAGS['web_traversal']}\n",
}


def market_page(title, body):
    nav = "".join(
        f'<a href="{MARKET_PREFIX}{path}">{label}</a>'
        for path, label in (
            ("/", "HOME"), ("/products", "PRODUCTS"), ("/profile?id=1001", "PROFILE"),
            ("/comments", "COMMENTS"), ("/files?name=manual.txt", "FILES"),
            ("/upload", "UPLOAD"), ("/preview", "URL PREVIEW"), ("/login", "ADMIN"),
        )
    )
    return f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} | TBX Market</title>
<style>
:root{{--ink:#17202a;--muted:#65717c;--line:#dbe1e5;--brand:#176b5b;--brand2:#0e5145;--soft:#edf7f3;--warn:#9d342e}}
*{{box-sizing:border-box}}body{{margin:0;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Yu Gothic UI",sans-serif;background:#f4f6f7}}
header{{background:#fff;border-bottom:1px solid var(--line)}}.top{{width:min(1080px,calc(100% - 28px));margin:auto;padding:18px 0 14px;display:flex;align-items:center;justify-content:space-between;gap:20px}}
.brand{{color:var(--brand);font-size:23px;font-weight:900;letter-spacing:.08em}}.tag{{color:var(--muted);font-size:12px}}
nav{{background:var(--brand)}}nav .links{{width:min(1080px,calc(100% - 28px));margin:auto;display:flex;flex-wrap:wrap}}nav a{{padding:12px 14px;color:#e9fffa;text-decoration:none;font-size:12px;font-weight:700}}nav a:hover{{background:var(--brand2)}}
main{{width:min(980px,calc(100% - 28px));margin:32px auto 70px}}h1{{margin:0 0 8px;font-size:30px}}h2{{font-size:20px}}p{{line-height:1.75;color:#46535d}}.lead{{margin-bottom:26px;color:var(--muted)}}
.card{{margin:16px 0;padding:22px;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:0 8px 30px rgba(23,32,42,.06)}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}}.product strong{{display:block;margin-bottom:8px}}.price{{color:var(--brand);font-size:20px;font-weight:800}}
form{{display:grid;gap:13px;max-width:620px}}label{{display:grid;gap:6px;color:var(--muted);font-size:12px}}input,textarea,button{{width:100%;padding:11px 12px;border:1px solid #c9d1d6;border-radius:5px;background:#fff;font:inherit}}textarea{{min-height:100px;resize:vertical}}button{{border-color:var(--brand);color:#fff;background:var(--brand);font-weight:700;cursor:pointer}}button:hover{{background:var(--brand2)}}
code,pre{{font-family:Consolas,monospace}}code{{padding:2px 5px;color:#70451a;background:#fff4df;border-radius:3px}}pre{{overflow:auto;padding:14px;color:#eafff9;background:#142822;border-radius:5px}}.notice{{padding:13px;border-left:4px solid var(--brand);background:var(--soft)}}.danger{{border-left-color:var(--warn);background:#fff0ef;color:#75231f}}.comment{{padding:13px 0;border-top:1px solid var(--line)}}.meta{{color:var(--muted);font-size:12px}}table{{width:100%;border-collapse:collapse;background:#fff}}th,td{{padding:11px;border:1px solid var(--line);text-align:left}}
@media(max-width:620px){{.top{{align-items:flex-start;flex-direction:column}}nav a{{padding:10px 9px;font-size:10px}}main{{margin-top:22px}}}}
</style></head><body><header><div class="top"><div class="brand">TBX MARKET</div><div class="tag">遉ｾ蜀・比ｿｮ逕ｨ繧ｷ繝ｧ繝・ヴ繝ｳ繧ｰ繝昴・繧ｿ繝ｫ</div></div><nav><div class="links">{nav}</div></nav></header>
<main><h1>{html.escape(title)}</h1>{body}</main></body></html>"""


def encode_market_token(payload):
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_market_token(token):
    try:
        padded = token + "=" * (-len(token) % 4)
        return json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def render_market_comment(value):
    # Keep a few harmless formatting tags to demonstrate stored markup. Script
    # and event-handler payloads are never executed; a training marker yields
    # the flag inside this isolated application instead.
    safe = html.escape(value)
    for tag in ("b", "strong", "em", "i", "code"):
        safe = safe.replace(f"&lt;{tag}&gt;", f"<{tag}>").replace(f"&lt;/{tag}&gt;", f"</{tag}>")
    training_xss = bool(re.search(r"<script[^>]*>\s*training\(\)\s*</script>|onerror\s*=\s*['\"]?training\(\)", value, re.I))
    flag = f'<div class="notice danger">螳牙・縺ｪ讓｡謫ｬXSS繧呈､懃衍縺励∪縺励◆: <code>{FLAGS["web_xss"]}</code></div>' if training_xss else ""
    return safe + flag


def parse_market_upload(payload, content_type):
    boundary_match = re.search(r"boundary=(?:\"([^\"]+)\"|([^;]+))", content_type, re.I)
    if not boundary_match:
        return None
    boundary = (boundary_match.group(1) or boundary_match.group(2)).encode("utf-8")
    for part in payload.split(b"--" + boundary):
        if b"\r\n\r\n" not in part:
            continue
        raw_headers, content = part.split(b"\r\n\r\n", 1)
        header_text = raw_headers.decode("utf-8", "replace")
        filename_match = re.search(r'filename="([^\"]*)"', header_text, re.I)
        if not filename_match:
            continue
        type_match = re.search(r"Content-Type:\s*([^\r\n]+)", header_text, re.I)
        return {
            "filename": os.path.basename(filename_match.group(1)),
            "content_type": (type_match.group(1).strip() if type_match else "application/octet-stream"),
            "content": content.rstrip(b"\r\n-"),
        }
    return None


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

    def request_body(self, limit=65536):
        declared = int(self.headers.get("content-length", "0") or "0")
        if declared > limit:
            return None
        return self.rfile.read(declared)

    def session_id(self):
        value = self.headers.get("X-TerminalBox-Session", "")
        session_id = value if UUID_PATTERN.match(value) else DEFAULT_SESSION_ID
        seed_session_state(session_id)
        return session_id

    def market_token(self, parsed):
        token = urllib.parse.parse_qs(parsed.query).get("token", [""])[0]
        authorization = self.headers.get("Authorization", "")
        if not token and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        return token

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = normalize_path(parsed.path)
        session_id = self.session_id()
        if path == "/api/status":
            self.send_json(200, {"status": "ok", "service": "terminalbox-challenge-target"})
        elif path == "/":
            self.send_bytes(200, page("TerminalBox Security Tool Lab", "<div class=\"card\"><p>髫秘屬縺輔ｌ縺滓ｼ皮ｿ堤畑繧ｿ繝ｼ繧ｲ繝・ヨ縺ｧ縺吶・/p><p>險ｱ蜿ｯ縺輔ｌ縺鬱erminalBox蜀・°繧峨・縺ｿ菴ｿ逕ｨ縺励※縺上□縺輔＞縲・/p></div>"))
        elif path == "/robots.txt":
            self.send_bytes(200, "User-agent: *\nDisallow: /internal-backup/\nDisallow: /server-status\n", "text/plain; charset=utf-8")
        elif path == "/internal-backup/flag.txt":
            self.send_bytes(200, FLAGS["gobuster"] + "\n", "text/plain; charset=utf-8")
        elif path in ("/internal-backup", "/internal-backup/"):
            self.send_bytes(200, "backup index: flag.txt\n", "text/plain; charset=utf-8")
        elif path == "/server-status":
            self.send_bytes(200, f"Training server status: enabled\nFlag: {FLAGS['nikto']}\n", "text/plain; charset=utf-8")
        elif path == "/burp/":
            body = """<div class=\"card\"><p>遉ｾ蜀・比ｿｮ縺ｮ蜑ｲ蠑慕筏隲九〒縺吶る∽ｿ｡繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒBurp Proxy縺ｧ謐墓拷縺励・code>discount</code>繧定ｪｿ譟ｻ縺励※縺上□縺輔＞縲・/p>
<form method=\"post\" action=\"/tool-target/burp/apply\"><label>遉ｾ蜩｡逡ｪ蜿ｷ<input name=\"employee\" value=\"student\"></label>
<input type=\"hidden\" name=\"discount\" value=\"10\"><button type=\"submit\">10%蜑ｲ蠑輔ｒ逕ｳ隲・/button></form></div>"""
            self.send_bytes(200, page("Burp Suite training", body))
        elif path == "/sql/":
            body = """<div class=\"card\"><form method=\"get\" action=\"/tool-target/sql/search\"><label>蝠・刀讀懃ｴ｢<input name=\"q\" value=\"apple\"></label><button>讀懃ｴ｢</button></form></div>"""
            self.send_bytes(200, page("蝠・刀讀懃ｴ｢API", body))
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
            body = """<div class=\"card\"><form method=\"post\" action=\"/tool-target/hydra/login\"><label>User<input name=\"username\"></label>
<label>Password<input type=\"password\" name=\"password\"></label><button>Login</button></form></div>"""
            self.send_bytes(200, page("Training Login", body))
        elif path == "/metasploit/status":
            if self.headers.get("X-TerminalBox-Msf") == "auxiliary-scan":
                self.send_json(200, {"service": "terminalbox-module-target", "flag": FLAGS["metasploit"]})
            else:
                self.send_json(403, {"error": "scanner header required"})
        elif path in ("/web-attacks", "/web-attacks/"):
            body = """<p class="lead">1縺､縺ｮ繧ｵ繧､繝医↓蜷ｫ縺ｾ繧後ｋ隍・焚縺ｮWeb讖溯・繧定ｪｿ縺ｹ縲？TTP繝ｪ繧ｯ繧ｨ繧ｹ繝医→繧｢繧ｯ繧ｻ繧ｹ蛻ｶ蠕｡縺ｮ蝓ｺ譛ｬ繧貞ｭｦ縺ｳ縺ｾ縺吶・/p>
<div class="card"><div class="grid"><div><h2>縺翫☆縺吶ａ蝠・刀</h2><p>蝠・刀雉ｼ蜈･譎ゅ・繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ遒ｺ隱阪＠縺ｾ縺吶・/p><a href="/tool-target/web-attacks/products">蝠・刀繧定ｦ九ｋ</a></div>
<div><h2>繝槭う繝励Ο繝輔ぅ繝ｼ繝ｫ</h2><p>繝ｦ繝ｼ繧ｶ繝ｼ逡ｪ蜿ｷ縺ｨ陦ｨ遉ｺ蜀・ｮｹ繧堤｢ｺ隱阪＠縺ｾ縺吶・/p><a href="/tool-target/web-attacks/profile?id=1001">繝励Ο繝輔ぅ繝ｼ繝ｫ繧定ｦ九ｋ</a></div>
<div><h2>縺雁ｮ｢讒倥・螢ｰ</h2><p>菫晏ｭ倥＆繧後◆蜈･蜉帙′縺ｩ縺ｮ繧医≧縺ｫ陦ｨ遉ｺ縺輔ｌ繧九°遒ｺ隱阪＠縺ｾ縺吶・/p><a href="/tool-target/web-attacks/comments">繧ｳ繝｡繝ｳ繝医ｒ隕九ｋ</a></div></div></div>"""
            self.send_bytes(200, market_page("繝帙・繝", body))
        elif path == "/web-attacks/products":
            with db_lock:
                rows = database.execute("SELECT id, name, description, price FROM market_products ORDER BY id").fetchall()
            cards = "".join(
                f'<div class="card product"><strong>{html.escape(name)}</strong><p>{html.escape(description)}</p><div class="price">ﾂ･{price:,}</div></div>'
                for _id, name, description, price in rows
            )
            buy_form = f"""<div class="card"><h2>遐比ｿｮ蝠・刀繧定ｳｼ蜈･</h2><p>騾壼ｸｸ逕ｻ髱｢縺ｯ10%蜑ｲ蠑輔□縺代ｒ騾∽ｿ｡縺励∪縺吶る∽ｿ｡縺輔ｌ繧稀TTP繝代Λ繝｡繝ｼ繧ｿ繧定ｦｳ蟇溘＠縺ｦ縺上□縺輔＞縲・/p>
<form method="post" action="{MARKET_PREFIX}/buy"><input type="hidden" name="product" value="1"><input type="hidden" name="discount" value="10"><button>10%蜑ｲ蠑輔〒雉ｼ蜈･</button></form></div>"""
            self.send_bytes(200, market_page("蝠・刀荳隕ｧ", f'<div class="grid">{cards}</div>{buy_form}'))
        elif path == "/web-attacks/profile":
            user_id = urllib.parse.parse_qs(parsed.query).get("id", ["1001"])[0]
            profiles = {
                "1001": ("Yamada Training", "training@example.invalid", "general user", ""),
                "1002": ("Sato Sales", "sales@example.invalid", "sales staff", ""),
                "1003": ("Admin Training", "admin@example.invalid", "site admin", FLAGS["web_idor"]),
            }
            profile = profiles.get(user_id)
            if not profile:
                self.send_bytes(404, market_page("繝励Ο繝輔ぅ繝ｼ繝ｫ", '<div class="card danger">繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲・/div>'))
            else:
                name, email, role, flag = profile
                flag_html = f'<p>遐比ｿｮ繝｡繝｢: <code>{flag}</code></p>' if flag else ""
                body = f'<p class="lead">陦ｨ遉ｺ荳ｭ縺ｮ繝ｦ繝ｼ繧ｶ繝ｼID: <code>{html.escape(user_id)}</code></p><div class="card"><h2>{html.escape(name)}</h2><p>{html.escape(email)}</p><p>讓ｩ髯・ {html.escape(role)}</p>{flag_html}</div>'
                self.send_bytes(200, market_page("繝励Ο繝輔ぅ繝ｼ繝ｫ", body))
        elif path == "/web-attacks/search":
            query = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            sql = f"SELECT id, name, description FROM market_products WHERE name LIKE '%{query}%'"
            try:
                with db_lock:
                    cursor = database.execute(sql)
                    columns = [item[0] for item in cursor.description]
                    rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                if "application/json" in self.headers.get("Accept", "") or self.headers.get("User-Agent", "").startswith("curl/"):
                    self.send_json(200, {"query": query, "results": rows})
                else:
                    result_html = "".join(f'<div class="card"><pre>{html.escape(json.dumps(row, ensure_ascii=False))}</pre></div>' for row in rows) or '<div class="card">隧ｲ蠖灘膚蜩√・縺ゅｊ縺ｾ縺帙ｓ縲・/div>'
                    self.send_bytes(200, market_page("蝠・刀讀懃ｴ｢", f'<form method="get" action="{MARKET_PREFIX}/search"><label>繧ｭ繝ｼ繝ｯ繝ｼ繝・input name="q" value="{html.escape(query)}"></label><button>讀懃ｴ｢</button></form>{result_html}'))
            except sqlite3.Error as error:
                self.send_json(500, {"error": f"SQLite error: {error}"})
        elif path == "/web-attacks/comments":
            with db_lock:
                rows = database.execute("SELECT author, body FROM market_comments WHERE session_id = ? ORDER BY id", (session_id,)).fetchall()
            comments = "".join(f'<div class="comment"><div class="meta">{html.escape(author)}</div><p>{render_market_comment(comment)}</p></div>' for author, comment in rows)
            form = f"""<div class="card"><h2>繧ｳ繝｡繝ｳ繝域兜遞ｿ</h2><form method="post" action="{MARKET_PREFIX}/comments"><label>縺雁錐蜑・input name="author" value="student"></label><label>繧ｳ繝｡繝ｳ繝・textarea name="comment"></textarea></label><button>謚慕ｨｿ縺吶ｋ</button></form></div>"""
            self.send_bytes(200, market_page("COMMENTS", f'<div class="card">{comments}</div>{form}'))
        elif path == "/web-attacks/files":
            name = urllib.parse.parse_qs(parsed.query).get("name", ["manual.txt"])[0]
            normalized = os.path.normpath("public/" + name).replace("\\", "/")
            if normalized.startswith("public/") and name in MARKET_PUBLIC_FILES:
                self.send_bytes(200, MARKET_PUBLIC_FILES[name], "text/plain; charset=utf-8")
            elif ".." in name and normalized in MARKET_PRIVATE_FILES:
                self.send_bytes(200, MARKET_PRIVATE_FILES[normalized], "text/plain; charset=utf-8")
            else:
                self.send_json(403, {"error": "training_file_not_allowed", "requested": name})
        elif path == "/web-attacks/upload":
            with db_lock:
                uploads = database.execute("SELECT filename, content_type, size FROM market_uploads WHERE session_id = ? ORDER BY id DESC", (session_id,)).fetchall()
            listing = "".join(f'<li>{html.escape(name)} ({html.escape(kind)}, {size} bytes)</li>' for name, kind, size in uploads) or "<li>縺ｾ縺繧｢繝・・繝ｭ繝ｼ繝峨・縺ゅｊ縺ｾ縺帙ｓ縲・/li>"
            body = f"""<p class="lead">繝励Ο繝輔ぅ繝ｼ繝ｫ逕ｻ蜒上ｒ逋ｻ骭ｲ縺励∪縺吶ゅヵ繧｡繧､繝ｫ縺ｯ繝｡繝｢繝ｪ蜀・・貍皮ｿ奪B縺ｫ繝｡繧ｿ繝・・繧ｿ縺縺台ｿ晏ｭ倥＆繧後∝ｮ溯｡後＆繧後∪縺帙ｓ縲・/p><div class="card"><form method="post" action="{MARKET_PREFIX}/upload" enctype="multipart/form-data"><label>逕ｻ蜒上ヵ繧｡繧､繝ｫ<input type="file" name="file"></label><button>繧｢繝・・繝ｭ繝ｼ繝・/button></form></div><div class="card"><h2>繧｢繝・・繝ｭ繝ｼ繝牙ｱ･豁ｴ</h2><ul>{listing}</ul></div>"""
            self.send_bytes(200, market_page("UPLOAD", body))
        elif path == "/web-attacks/preview":
            url = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
            if not url:
                body = f'<p class="lead">蜈･蜉帙＠縺欟RL繧偵し繝ｼ繝舌・蛛ｴ縺ｧ蜿門ｾ励☆繧九・繝ｬ繝薙Η繝ｼ讖溯・縺ｧ縺吶ゅ％縺ｮ貍皮ｿ偵〒縺ｯ莠句燕螳夂ｾｩ縺励◆逍台ｼｼURL縺縺代ｒ謇ｱ縺・∪縺吶・/p><div class="card"><form method="get" action="{MARKET_PREFIX}/preview"><label>URL<input name="url" placeholder="https://market.tbx/products"></label><button>繝励Ξ繝薙Η繝ｼ</button></form></div>'
                self.send_bytes(200, market_page("URL PREVIEW", body))
            elif url == "http://internal.tbx/admin":
                self.send_json(200, {"url": url, "source": "simulated_internal_route", "service": "TBX Market Admin", "flag": FLAGS["web_ssrf"]})
            elif url in ("https://market.tbx/products", "http://market.tbx/products"):
                self.send_json(200, {"url": url, "source": "simulated_public_route", "title": "TBX Market Products"})
            else:
                self.send_json(400, {"error": "external_url_blocked", "detail": "Only predefined training URLs are available."})
        elif path == "/web-attacks/login":
            body = f'<p class="lead">遐比ｿｮ逕ｨ繧｢繧ｫ繧ｦ繝ｳ繝医〒繝ｭ繧ｰ繧､繝ｳ縺励∫匱陦後＆繧後ｋ繝医・繧ｯ繝ｳ縺ｮ蜀・ｮｹ繧堤｢ｺ隱阪＠縺ｾ縺吶・/p><div class="card"><form method="post" action="{MARKET_PREFIX}/login"><label>繝ｦ繝ｼ繧ｶ繝ｼ蜷・input name="username" value="student"></label><label>繝代せ繝ｯ繝ｼ繝・input type="password" name="password" value="market123"></label><button>繝ｭ繧ｰ繧､繝ｳ</button></form></div>'
            self.send_bytes(200, market_page("LOGIN", body))
        elif path == "/web-attacks/admin":
            token = self.market_token(parsed)
            payload = decode_market_token(token)
            if payload and payload.get("nonce") == market_nonce_for_session(session_id) and payload.get("role") == "admin":
                self.send_json(200, {"authenticated": True, "user": payload.get("user", "student"), "role": "admin", "flag": FLAGS["web_jwt"]})
            else:
                self.send_json(403, {"authenticated": False, "error": "admin_role_required"})
        else:
            self.send_json(404, {"error": "not_found", "path": path})

    def do_POST(self):
        path = normalize_path(urllib.parse.urlparse(self.path).path)
        session_id = self.session_id()
        if path in ("/api/lab/reset", "/web-attacks/api/lab/reset"):
            reset_session_state(session_id)
            self.send_json(200, {"status": "reset"})
        elif path == "/web-attacks/buy":
            values = self.form()
            product = values.get("product", [""])[0]
            discount = values.get("discount", [""])[0]
            if product == "1" and discount == "90":
                body = f'<div class="card"><h2>遐比ｿｮ蜑ｲ蠑輔ｒ驕ｩ逕ｨ縺励∪縺励◆</h2><p>繝ｪ繧ｯ繧ｨ繧ｹ繝亥・縺ｮ蜑ｲ蠑慕紫縺悟､画峩縺輔ｌ縺ｦ縺・∪縺吶・/p><code>{FLAGS["web_parameter"]}</code></div>'
            else:
                body = '<div class="card"><h2>雉ｼ蜈･繧貞女縺台ｻ倥￠縺ｾ縺励◆</h2><p>騾壼ｸｸ縺ｮ10%蜑ｲ蠑輔′驕ｩ逕ｨ縺輔ｌ縺ｾ縺励◆縲ゅヶ繝ｩ繧ｦ繧ｶ繝ｼ縺ｾ縺溘・Burp縺ｧ騾∽ｿ｡繝代Λ繝｡繝ｼ繧ｿ繝ｼ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・/p></div>'
            self.send_bytes(200, market_page("雉ｼ蜈･邨先棡", body))
        elif path == "/web-attacks/comments":
            values = self.form()
            author = values.get("author", ["student"])[0][:80]
            comment = values.get("comment", [""])[0][:2000]
            if not comment:
                self.send_json(400, {"error": "comment_required"})
            else:
                with db_lock:
                    database.execute("INSERT INTO market_comments(session_id, author, body) VALUES (?, ?, ?)", (session_id, author, comment))
                    database.commit()
                self.send_bytes(200, market_page("繧ｳ繝｡繝ｳ繝医ｒ菫晏ｭ倥＠縺ｾ縺励◆", f'<div class="card"><p>繧ｳ繝｡繝ｳ繝医・菫晏ｭ倥＆繧後∪縺励◆縲・OMMENTS逕ｻ髱｢縺ｧ陦ｨ遉ｺ邨先棡繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・/p><p>{render_market_comment(comment)}</p><a href="{MARKET_PREFIX}/comments">COMMENTS縺ｸ謌ｻ繧・/a></div>'))
        elif path == "/web-attacks/upload":
            payload = self.request_body(131072)
            if payload is None:
                self.send_json(413, {"error": "upload_too_large"})
            else:
                uploaded = parse_market_upload(payload, self.headers.get("Content-Type", ""))
                if not uploaded or not uploaded["filename"]:
                    self.send_json(400, {"error": "file_required"})
                else:
                    filename = uploaded["filename"][:180]
                    content_type = uploaded["content_type"][:120]
                    size = len(uploaded["content"])
                    with db_lock:
                        database.execute(
                            "INSERT INTO market_uploads(session_id, filename, content_type, size) VALUES (?, ?, ?, ?)",
                            (session_id, filename, content_type, size),
                        )
                        database.commit()
                    suspicious_extension = os.path.splitext(filename.lower())[1] in {".php", ".phtml", ".phar", ".jsp", ".asp", ".aspx"}
                    suspicious_type = content_type.lower() in {"application/x-php", "application/php", "text/x-php"}
                    response = {"stored": True, "filename": filename, "content_type": content_type, "size": size, "executed": False}
                    if suspicious_extension or suspicious_type:
                        response["flag"] = FLAGS["web_upload"]
                        response["note"] = "Training detection only. Uploaded content is not stored or executed."
                    self.send_json(200, response)
        elif path == "/web-attacks/login":
            values = self.form()
            username = values.get("username", [""])[0]
            password = values.get("password", [""])[0]
            if username == "student" and password == "market123":
                token = encode_market_token({"user": username, "role": "user", "nonce": market_nonce_for_session(session_id)})
                self.send_json(200, {
                    "authenticated": True,
                    "token": token,
                    "token_format": "base64url JSON (unsigned training token)",
                    "admin_endpoint": "/web-attacks/admin",
                })
            else:
                self.send_json(401, {"authenticated": False, "error": "invalid_credentials"})
        elif path == "/burp/apply":
            values = self.form()
            employee = values.get("employee", [""])[0]
            discount = values.get("discount", [""])[0]
            if employee == "student" and discount == "90":
                self.send_bytes(200, page("Discount accepted", f"<div class=\"card\"><p>Training discount accepted.</p><code>{FLAGS['burp']}</code></div>"))
            else:
                self.send_bytes(200, page("Discount result", "<div class=\"card\"><p>Default 10% discount accepted. Inspect the request parameters.</p></div>"))
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
