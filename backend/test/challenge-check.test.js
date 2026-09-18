import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChallengeAnswer } from '../src/challenge-check.js';
import { linuxLabFlag } from '../src/linux-lab.js';

test('accepts a correct tool challenge answer', () => {
  const result = checkChallengeAnswer('netcat', ' TBX{netcat_line_protocol}\n');
  assert.equal(result.status, 200);
  assert.equal(result.body.correct, true);
});

test('rejects an incorrect answer without revealing the expected value', () => {
  const result = checkChallengeAnswer('john', 'incorrect');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { correct: false, message: '一致しません。出力をもう一度確認してください。' });
});

test('rejects unknown challenge ids', () => {
  assert.equal(checkChallengeAnswer('missing', 'answer').status, 404);
});

test('accepts every Web Attacks flag without exposing it on failure', () => {
  const expected = new Map([
    ['web-parameter', 'TBX{web_parameter_tampering}'],
    ['web-idor', 'TBX{web_idor_profile}'],
    ['web-sqli', 'TBX{web_sqli_basic}'],
    ['web-xss', 'TBX{web_stored_xss}'],
    ['web-traversal', 'TBX{web_path_traversal}'],
    ['web-upload', 'TBX{web_file_upload}'],
    ['web-ssrf', 'TBX{web_ssrf_internal}'],
    ['web-jwt', 'TBX{web_jwt_admin}'],
  ]);

  for (const [id, flag] of expected) {
    assert.equal(checkChallengeAnswer(id, flag).body.correct, true, id);
    const rejected = checkChallengeAnswer(id, 'TBX{wrong}');
    assert.equal(rejected.body.correct, false, id);
    assert.equal(JSON.stringify(rejected).includes(flag), false, id);
  }
});

test('accepts target understand and defend choices without flag literals', () => {
  assert.equal(checkChallengeAnswer('target3-understand', 'A').body.correct, true);
  assert.equal(checkChallengeAnswer('target3-defend', 'C,A,B').body.correct, true);
  assert.equal(checkChallengeAnswer('target4-defend', 'A,B,C,D').body.correct, true);
  assert.equal(checkChallengeAnswer('target5-defend', 'A,B,C,D,E').body.correct, false);
});

test('accepts Linux Lab privilege escalation flags and choices', () => {
  const sessionA = '11111111-1111-4111-8111-111111111111';
  const sessionB = '22222222-2222-4222-8222-222222222222';

  for (let targetId = 6; targetId <= 9; targetId += 1) {
    const id = `target${targetId}`;
    const flag = linuxLabFlag(sessionA, targetId);
    const otherSessionFlag = linuxLabFlag(sessionB, targetId);
    assert.match(flag, new RegExp(`^TBX\\{target${targetId}_[0-9a-f]{2}\\}$`), id);
    assert.notEqual(flag, otherSessionFlag, id);
    assert.equal(checkChallengeAnswer(id, flag, sessionA).body.correct, true, id);
    assert.equal(checkChallengeAnswer(id, otherSessionFlag, sessionA).body.correct, false, id);
    assert.equal(checkChallengeAnswer(`${id}-understand`, 'A').body.correct, true, id);
    assert.equal(checkChallengeAnswer(`${id}-defend`, 'B,C,A').body.correct, true, id);
    assert.equal(JSON.stringify(checkChallengeAnswer(id, 'FLAG{wrong}', sessionA)).includes(flag), false, id);
  }
});
