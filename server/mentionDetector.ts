const COACH_MENTION_PATTERNS = [
  /@gena\b/i,
  /@coach\b/i,
  /@mentor\b/i,
];

export function detectCoachMention(content: string): boolean {
  return COACH_MENTION_PATTERNS.some(pattern => pattern.test(content));
}

export function highlightMentions(content: string): string {
  let result = content;
  COACH_MENTION_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, (match) => `**${match}**`);
  });
  return result;
}
