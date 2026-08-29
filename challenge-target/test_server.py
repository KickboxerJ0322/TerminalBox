import unittest
import threading
import urllib.parse
import urllib.request

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


if __name__ == "__main__":
    unittest.main()
