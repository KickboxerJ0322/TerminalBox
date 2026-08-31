import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCommand, CommandClassification } from '../src/agent/command-policy.js';

const expected = {
  [CommandClassification.READ_ONLY]: [
    'pwd', 'whoami', 'ls -la', 'cat README.txt', 'ps aux', 'ip addr',
    'curl http://target:3000/api/status', 'curl -X GET http://target:3000/api/status', 'nmap target', 'nmap -p 80 target',
  ],
  [CommandClassification.CONFIRM_REQUIRED]: [
    'touch test.txt', 'mkdir test', 'rm test.txt', 'mv a b', 'cp a b', 'chmod 777 file',
    'ls > list.txt', 'curl -o file http://target:3000/', 'find . -delete', "sed -i 's/a/b/' file",
    'ls && rm file', 'pwd ; touch file', 'cat file > copy', 'git remote add origin http://target/repo.git',
  ],
  [CommandClassification.DENIED]: [
    'sudo id', 'su', 'reboot', 'shutdown now', "bash -c 'pwd'", "sh -c 'pwd'", 'eval pwd',
    'docker ps', 'kubectl get pods', 'gcloud projects list', 'pwd $(touch test)', '`whoami`',
    'curl https://example.com/', 'find . -exec rm {} ;', '/tmp/pwd', 'npm run arbitrary',
  ],
};

for (const [classification, commands] of Object.entries(expected)) {
  test(`${classification} command classification`, () => {
    for (const command of commands) {
      assert.equal(classifyCommand(command).classification, classification, command);
    }
  });
}

test('a read-only pipeline remains structured and read-only', () => {
  const result = classifyCommand("cat README.txt | grep TerminalBox");
  assert.equal(result.classification, CommandClassification.READ_ONLY);
  assert.deepEqual(result.parsedCommands, [['cat', 'README.txt'], ['grep', 'TerminalBox']]);
  assert.equal(result.plan.sequence[0].pipeline.length, 2);
});

test('blocks allowlisted-command escape hatches', () => {
  for (const command of [
    "sed 'e id' file.txt",
    "sed 's/a/id/e' file.txt",
    'sed -f script.sed file.txt',
    'ip netns exec red pwd',
    'tshark -X lua_script:payload.lua',
    'git -ccore.pager=evil log',
    'git diff --ext-diff',
    'git show --textconv HEAD',
  ]) {
    assert.equal(classifyCommand(command).classification, CommandClassification.DENIED, command);
  }
  for (const command of [
    'curl -XPOST http://target/login',
    'curl -dname=test http://target/login',
    'curl --json={} http://target/api',
  ]) {
    assert.equal(classifyCommand(command).classification, CommandClassification.CONFIRM_REQUIRED, command);
  }
  assert.equal(classifyCommand("sed -n '1,5p' file.txt").classification, CommandClassification.READ_ONLY);
  assert.equal(classifyCommand("sed 's/foo/bar/g' file.txt").classification, CommandClassification.READ_ONLY);
});
