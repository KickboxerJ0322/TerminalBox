import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChallengeAnswer } from '../src/challenge-check.js';

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
