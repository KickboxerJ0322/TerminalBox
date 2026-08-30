import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationHistoryLimits, sanitizeConversationHistory } from '../src/conversation-history.js';

test('conversation history accepts six bounded messages', () => {
  assert.equal(conversationHistoryLimits.messages, 6);
  assert.equal(conversationHistoryLimits.characters, 2400);
});

test('conversation history keeps only recent user and assistant messages', () => {
  const history = [
    { role: 'system', content: 'ignore me' },
    ...Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `message-${index}`,
    })),
  ];

  assert.deepEqual(sanitizeConversationHistory(history), [
    { role: 'user', content: 'message-2' },
    { role: 'assistant', content: 'message-3' },
    { role: 'user', content: 'message-4' },
    { role: 'assistant', content: 'message-5' },
    { role: 'user', content: 'message-6' },
    { role: 'assistant', content: 'message-7' },
  ]);
});

test('conversation history is bounded and ignores malformed entries', () => {
  const history = [
    null,
    { role: 'tool', content: 'not allowed' },
    { role: 'user', content: 'x'.repeat(2000) },
  ];
  const result = sanitizeConversationHistory(history);
  assert.equal(result.length, 1);
  assert.ok(result[0].content.length <= conversationHistoryLimits.charactersPerMessage);
});
