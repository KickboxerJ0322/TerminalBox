export const conversationHistoryLimits = Object.freeze({
  messages: 4,
  characters: 1000,
  charactersPerMessage: 400,
});

export function sanitizeConversationHistory(value) {
  if (!Array.isArray(value)) return [];

  const sanitized = [];
  let remainingCharacters = conversationHistoryLimits.characters;

  for (let index = value.length - 1; index >= 0 && sanitized.length < conversationHistoryLimits.messages; index -= 1) {
    const item = value[index];
    if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') continue;
    const content = item.content.trim().slice(0, Math.min(
      conversationHistoryLimits.charactersPerMessage,
      remainingCharacters,
    ));
    if (!content) continue;
    sanitized.unshift({ role: item.role, content });
    remainingCharacters -= content.length;
    if (remainingCharacters <= 0) break;
  }

  return sanitized;
}
