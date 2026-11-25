"""The real PHP component only reads a fixture; it never executes commands."""
import json
import os
from pathlib import Path
import pwd
import subprocess
import unittest


class PhpLessonTest(unittest.TestCase):
    def run_lesson(self, body):
        completed = subprocess.run(
            [os.environ.get("PHP_TEST_BINARY", "/usr/bin/php"), "-n", str(Path(__file__).with_name("lesson.php"))],
            input=json.dumps(body), text=True, capture_output=True, check=True, timeout=3,
        )
        return json.loads(completed.stdout)

    def test_ordinary_fixture_reader(self):
        if os.environ.get("PHP_EXPECTED_USER"):
            self.assertEqual(os.getuid(), 1001)
            self.assertEqual(pwd.getpwuid(os.getuid()).pw_name, os.environ["PHP_EXPECTED_USER"])
        result = self.run_lesson({"action": "customers"})
        self.assertEqual(result["status"], 200)
        self.assertRegex(result["runtime"], r"^PHP 8\.")
        self.assertEqual(result["output"], Path(__file__).with_name("data").joinpath("customers.csv").read_text())
        self.assertIn("1990-04-15", result["output"])
        self.assertNotIn("TBX{", result["output"])

    def test_old_commands_and_arbitrary_actions_are_not_supported(self):
        for body in [
            {"mode": "vulnerable", "topic": "summary; whoami"},
            {"action": "report", "topic": "summary; cat data/customers.csv"},
            {"action": "memory-demo", "step": "inspect"},
            {"action": "customers", "command": "id"},
            {},
        ]:
            with self.subTest(body=body):
                result = self.run_lesson(body)
                self.assertEqual(result["status"], 400)
                self.assertNotIn("output", result)


if __name__ == "__main__":
    unittest.main()
