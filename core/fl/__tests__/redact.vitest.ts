import { describe, it, expect } from "vitest";
import { redactMessages } from "../redact.js";

describe("redactMessages", () => {
  it("redacts OpenAI-style keys", () => {
    const { messages } = redactMessages([
      { role: "user", content: "My key is sk-fakekey1234567890abcdef" },
    ]);
    expect(messages[0].content).toContain("[REDACTED]");
    expect(messages[0].content).not.toContain("sk-fakekey");
  });

  it("redacts Anthropic-style keys", () => {
    const { messages } = redactMessages([
      { role: "user", content: "token=sk-ant-api-123456789012345678901234" },
    ]);
    expect(messages[0].content).toContain("[REDACTED]");
    expect(messages[0].content).not.toContain("sk-ant-api");
  });

  it("returns redaction summary with count", () => {
    const { redactions } = redactMessages([
      {
        role: "user",
        content: "keys: sk-fake12345678901234 and sk-other12345678901234",
      },
    ]);
    expect(redactions.length).toBeGreaterThan(0);
    const entry = redactions.find((r) => r.pattern_id === "secret:openai-key");
    expect(entry?.count).toBe(2);
  });

  it("returns empty redactions when nothing to redact", () => {
    const { messages, redactions } = redactMessages([
      { role: "user", content: "What is the weather today?" },
    ]);
    expect(redactions).toHaveLength(0);
    expect(messages[0].content).toBe("What is the weather today?");
  });

  it("handles multiple messages", () => {
    const { messages } = redactMessages([
      { role: "user", content: "key: sk-fakekey123456789012345" },
      { role: "assistant", content: "Noted." },
    ]);
    expect(messages[0].content).toContain("[REDACTED]");
    expect(messages[1].content).toBe("Noted.");
  });
});
