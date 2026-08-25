import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationHistoryLimits, sanitizeConversationHistory } from '../src/conversation-history.js';

test('conversation history keeps only recent user and assistant messages', () => {
  const history = [
    { role: 'system', content: 'ignore me' },
    ...Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `message-${index}`,
    })),
  ];

  assert.deepEqual(sanitizeConversationHistory(history), [
    { role: 'user', content: 'message-2' },
    { role: 'assistant', content: 'message-3' },
    { role: 'user', content: 'message-4' },
    { role: 'assistant', content: 'message-5' },
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
