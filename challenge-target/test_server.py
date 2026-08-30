import base64
import json
import unittest
import threading
import urllib.parse
import urllib.request
from urllib.error import HTTPError

import server as challenge_server
from server import ChallengeHandler, ThreadingHTTPServer, normalize_path, page


class ToolTargetRoutingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), ChallengeHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        challenge_server.database.close()

    def setUp(self):
        self.post("/tool-target/web-attacks/api/lab/reset", b"")

    def get(self, path):
        request = urllib.request.Request(self.base_url + path, headers={"Accept": "application/json"})
        return urllib.request.urlopen(request, timeout=2).read().decode()

    def post(self, path, payload, content_type="application/x-www-form-urlencoded"):
        request = urllib.request.Request(self.base_url + path, data=payload, headers={"Content-Type": content_type})
        return urllib.request.urlopen(request, timeout=2).read().decode()

    def test_prefixed_paths_are_normalized(self):
        self.assertEqual(normalize_path("/tool-target/"), "/")
        self.assertEqual(normalize_path("/tool-target/burp/"), "/burp/")
        self.assertEqual(normalize_path("/hydra/login"), "/hydra/login")

    def test_navigation_keeps_the_public_proxy_prefix(self):
        document = page("test", "<p>body</p>")
        self.assertIn('href="/tool-target/burp/"', document)
        self.assertIn('href="/tool-target/sql/"', document)
        self.assertIn('href="/tool-target/hydra/"', document)

    def test_prefixed_pages_and_forms_work(self):
        for path, expected_action in (
            ("/tool-target/burp/", "/tool-target/burp/apply"),
            ("/tool-target/sql/", "/tool-target/sql/search"),
            ("/tool-target/hydra/", "/tool-target/hydra/login"),
        ):
            with self.subTest(path=path):
                document = urllib.request.urlopen(self.base_url + path, timeout=2).read().decode()
                self.assertIn(expected_action, document)

    def test_prefixed_hydra_login_returns_the_flag(self):
        payload = urllib.parse.urlencode({"username": "analyst", "password": "bluebird"}).encode()
        request = urllib.request.Request(self.base_url + "/tool-target/hydra/login", data=payload)
        response = urllib.request.urlopen(request, timeout=2).read().decode()
        self.assertIn("TBX{hydra_bounded_login}", response)

    def test_web_attacks_home_and_parameter_tampering(self):
        self.assertIn("TBX MARKET", self.get("/tool-target/web-attacks/"))
        normal = self.post("/web-attacks/buy", urllib.parse.urlencode({"product": "1", "discount": "10"}).encode())
        self.assertNotIn("TBX{web_parameter_tampering}", normal)
        changed = self.post("/web-attacks/buy", urllib.parse.urlencode({"product": "1", "discount": "90"}).encode())
        self.assertIn("TBX{web_parameter_tampering}", changed)

    def test_web_attacks_idor_and_sql_injection(self):
        self.assertNotIn("TBX{web_idor_profile}", self.get("/web-attacks/profile?id=1001"))
        self.assertIn("TBX{web_idor_profile}", self.get("/web-attacks/profile?id=1003"))
        injection = urllib.parse.quote("' UNION SELECT id,label,value FROM training_secrets--")
        response = json.loads(self.get(f"/web-attacks/search?q={injection}"))
        self.assertTrue(any(row.get("description") == "TBX{web_sqli_basic}" for row in response["results"]))

    def test_stored_xss_is_simulated_and_resettable(self):
        marker = "<script>training()</script>"
        payload = urllib.parse.urlencode({"author": "student", "comment": marker}).encode()
        response = self.post("/web-attacks/comments", payload)
        self.assertIn("TBX{web_stored_xss}", response)
        document = self.get("/web-attacks/comments")
        self.assertIn("&lt;script&gt;training()&lt;/script&gt;", document)
        self.assertNotIn(marker, document)
        self.post("/web-attacks/api/lab/reset", b"")
        self.assertNotIn("TBX{web_stored_xss}", self.get("/web-attacks/comments"))

    def test_path_traversal_uses_virtual_files_only(self):
        self.assertIn("TBX Market", self.get("/web-attacks/files?name=manual.txt"))
        self.assertIn("TBX{web_path_traversal}", self.get("/web-attacks/files?name=../private/training-note.txt"))
        with self.assertRaises(HTTPError) as blocked:
            self.get("/web-attacks/files?name=../../../../etc/passwd")
        self.assertEqual(blocked.exception.code, 403)
        blocked.exception.close()

    def test_upload_records_metadata_without_executing_content(self):
        boundary = "TerminalBoxBoundary"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"training.php\"\r\n"
            "Content-Type: application/x-php\r\n\r\ntraining only\r\n"
            f"--{boundary}--\r\n"
        ).encode()
        response = json.loads(self.post("/web-attacks/upload", body, f"multipart/form-data; boundary={boundary}"))
        self.assertEqual(response["flag"], "TBX{web_file_upload}")
        self.assertEqual(response["executed"], False)
        self.assertNotIn("training only", self.get("/web-attacks/upload"))
        self.assertIn("training.php", self.get("/web-attacks/upload"))
        self.post("/api/lab/reset", b"")
        self.assertNotIn("training.php", self.get("/web-attacks/upload"))

    def test_ssrf_is_a_fixed_simulation_with_no_arbitrary_fetch(self):
        internal = json.loads(self.get("/web-attacks/preview?url=http%3A%2F%2Finternal.tbx%2Fadmin"))
        self.assertEqual(internal["flag"], "TBX{web_ssrf_internal}")
        with self.assertRaises(HTTPError) as blocked:
            self.get("/web-attacks/preview?url=http%3A%2F%2F127.0.0.1%3A1%2Fsecret")
        self.assertEqual(blocked.exception.code, 400)
        blocked.exception.close()

    def test_unsigned_training_token_role_and_reset_invalidation(self):
        login = json.loads(self.post("/web-attacks/login", urllib.parse.urlencode({"username": "student", "password": "market123"}).encode()))
        token = login["token"]
        payload = json.loads(base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)))
        payload["role"] = "admin"
        changed = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
        admin = json.loads(self.get("/web-attacks/admin?token=" + urllib.parse.quote(changed)))
        self.assertEqual(admin["flag"], "TBX{web_jwt_admin}")
        self.post("/web-attacks/api/lab/reset", b"")
        with self.assertRaises(HTTPError) as rejected:
            self.get("/web-attacks/admin?token=" + urllib.parse.quote(changed))
        self.assertEqual(rejected.exception.code, 403)
        rejected.exception.close()


if __name__ == "__main__":
    unittest.main()
