import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuickReply } from '../src/quick-replies.js';

test('common greetings and small talk use compact quick replies', () => {
  for (const message of ['こんにちは', 'ありがとう！', '元気ですか？', '雑談しよう', 'あなたは何ができるの？']) {
    const reply = getQuickReply(message);
    assert.equal(typeof reply, 'string');
    assert.ok([...reply].length <= 30, `${message}: ${reply}`);
  }
});

test('substantive questions are sent to the model', () => {
  assert.equal(getQuickReply('nmap target の結果を説明して'), null);
  assert.equal(getQuickReply('こんにちは。nmapについて教えて'), null);
});
