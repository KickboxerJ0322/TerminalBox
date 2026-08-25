const quickReplyRules = [
  {
    pattern: /^(こんにちは|こんばんは|おはよう(?:ございます)?|hi|hello)[!！。．、,\s]*$/iu,
    reply: 'こんにちは！何を学びますか？',
  },
  {
    pattern: /^(ありがとう(?:ございます)?|ありがと|thanks|thank you)[!！。．、,\s]*$/iu,
    reply: 'どういたしまして！',
  },
  {
    pattern: /^(よろしく(?:お願いします)?)[!！。．、,\s]*$/u,
    reply: 'こちらこそ、よろしくお願いします！',
  },
  {
    pattern: /^(元気(?:ですか)?|調子(?:は)?どう)[?？!！。．、,\s]*$/u,
    reply: '元気です。今日は何を学びますか？',
  },
  {
    pattern: /^(雑談|雑談しよう|話そう)[!！。．、,\s]*$/u,
    reply: 'もちろんです。気軽に話しましょう。',
  },
  {
    pattern: /^(いい天気(?:ですね)?|今日はいい天気(?:ですね)?)[!！。．、,\s]*$/u,
    reply: 'そうですね。気軽に質問してください。',
  },
  {
    pattern: /^(あなたは)?何ができる(?:の|んですか)?[?？!！。．、,\s]*$/u,
    reply: 'Linuxとセキュリティ学習を手伝えます。',
  },
];

export function getQuickReply(message) {
  if (typeof message !== 'string' || message.length > 80) return null;
  const normalized = message.trim();
  return quickReplyRules.find(({ pattern }) => pattern.test(normalized))?.reply ?? null;
}
