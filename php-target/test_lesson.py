"""Run real PHP and fixed OS operations; also used during the Lab image build."""
import json
import os
from pathlib import Path
import subprocess
import unittest


class PhpLessonTest(unittest.TestCase):
    def run_lesson(self, topic, mode="vulnerable"):
        completed = subprocess.run(
            [os.environ.get("PHP_TEST_BINARY", "/usr/bin/php"), "-n", str(Path(__file__).with_name("lesson.php"))],
            input=json.dumps({"mode": mode, "topic": topic}),
            text=True, capture_output=True, check=True, timeout=3,
        )
        return json.loads(completed.stdout)

    def test_real_identity_and_fixture_read(self):
        identity = self.run_lesson("summary; whoami")
        self.assertTrue(identity["identityObserved"])
        self.assertRegex(identity["runtime"], r"^PHP 8\.")
        if os.environ.get("PHP_EXPECTED_USER"):
            self.assertEqual(identity["output"].strip(), os.environ["PHP_EXPECTED_USER"])
        uid = self.run_lesson("summary; id")
        self.assertTrue(uid["identityObserved"])
        if os.environ.get("PHP_EXPECTED_USER"):
            self.assertIn("uid=1001(phpstudent)", uid["output"])
            self.assertNotIn("0(root)", uid["output"])
        self.assertIn("customers.csv", self.run_lesson("summary; ls data")["output"])
        data = self.run_lesson("summary; cat data/customers.csv")
        self.assertTrue(data["dataRead"])
        self.assertIn("demo001@example.invalid", data["output"])
        self.assertNotIn("TBX{", data["output"])  # Flags belong to the backend session.

    def test_secure_rejects_all_teaching_commands(self):
        for operation in ["whoami", "id", "ls data", "cat data/customers.csv"]:
            with self.subTest(operation=operation):
                result = self.run_lesson("summary; " + operation, "secure")
                self.assertEqual(result["status"], 400)
                self.assertTrue(result["blocked"])
                self.assertFalse(result["identityObserved"])
                self.assertFalse(result["dataRead"])
                self.assertNotIn("demo001", result["output"])
                self.assertNotIn("TBX{", result["output"])

    def test_business_value_works_in_both_versions(self):
        for mode in ["vulnerable", "secure"]:
            result = self.run_lesson("summary", mode)
            self.assertEqual(result["status"], 200)
            self.assertFalse(result["dataRead"])

    def test_other_paths_shell_syntax_and_changes_are_rejected(self):
        for topic in ["summary; cat /etc/passwd", "summary; cat data/../lesson.php", "summary; whoami; id", "summary; id && whoami", "summary; rm data/customers.csv", "summary; $(id)", "summary; whoami\n", "summary; /usr/bin/id"]:
            with self.subTest(topic=topic):
                result = self.run_lesson(topic)
                self.assertEqual(result["status"], 400)
                self.assertFalse(result["identityObserved"])
                self.assertFalse(result["dataRead"])


if __name__ == "__main__":
    unittest.main()
