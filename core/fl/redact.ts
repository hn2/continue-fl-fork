interface RedactPattern {
  id: string;
  pattern: RegExp;
}

export const REDACT_PATTERNS: RedactPattern[] = [
  { id: "secret:openai-key", pattern: /sk-[A-Za-z0-9]{20,}/g },
  { id: "secret:anthropic-key", pattern: /sk-ant-[A-Za-z0-9-]{20,}/g },
  { id: "secret:bearer-token", pattern: /Bearer\s+[A-Za-z0-9+/=_-]{20,}/g },
  { id: "secret:aws-access-key", pattern: /AKIA[A-Z0-9]{16}/g },
  { id: "secret:github-token", pattern: /ghp_[A-Za-z0-9]{36}/g },
];

export interface Message {
  role: string;
  content: string;
}

export interface RedactionSummary {
  pattern_id: string;
  count: number;
  placeholder: string;
}

export function redactMessages(messages: Message[]): {
  messages: Message[];
  redactions: RedactionSummary[];
} {
  const counts: Record<string, number> = {};

  const redacted = messages.map((m) => {
    let content = m.content ?? "";
    for (const { id, pattern } of REDACT_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        counts[id] = (counts[id] ?? 0) + matches.length;
        content = content.replace(pattern, "[REDACTED]");
      }
    }
    return { ...m, content };
  });

  const redactions: RedactionSummary[] = Object.entries(counts).map(
    ([pattern_id, count]) => ({ pattern_id, count, placeholder: "[REDACTED]" }),
  );

  return { messages: redacted, redactions };
}
