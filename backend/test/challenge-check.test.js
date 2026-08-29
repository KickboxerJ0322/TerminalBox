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
