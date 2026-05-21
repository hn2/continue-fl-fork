import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureConversation } from "../FusionLayerCapture.js";
import type { FusionLayerSettings } from "../settings.js";

const BASE_SETTINGS: FusionLayerSettings = {
  enableRead: true,
  enableWrite: true,
  engineUrl: "https://api.fusionlayer.app",
  apiKey: "test-key-abc123",
  privacyMode: "smart",
  maxArtifacts: 10,
  relevanceThreshold: 0.7,
  consentDate: "2026-05-21",
};

function setSettings(s: Partial<FusionLayerSettings>) {
  localStorage.setItem(
    "fusionlayer_settings",
    JSON.stringify({ ...BASE_SETTINGS, ...s }),
  );
}

const MESSAGES = [
  { role: "user", content: "What is the capital of France?" },
  { role: "assistant", content: "Paris." },
];

describe("captureConversation", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns skipped when enableWrite is false", async () => {
    setSettings({ enableWrite: false });
    const result = await captureConversation({
      conversationId: "conv-1",
      messages: MESSAGES,
      fetch: vi.fn(),
    });
    expect(result.skipped).toBe("write_disabled");
  });

  it("returns skipped when privacy mode is incognito", async () => {
    setSettings({ privacyMode: "incognito" });
    const result = await captureConversation({
      conversationId: "conv-2",
      messages: MESSAGES,
      fetch: vi.fn(),
    });
    expect(result.skipped).toBe("incognito");
  });

  it("returns skipped when consent not granted (consentDate null)", async () => {
    setSettings({ consentDate: null });
    const result = await captureConversation({
      conversationId: "conv-3",
      messages: MESSAGES,
      fetch: vi.fn(),
    });
    expect(result.skipped).toBe("consent_not_granted");
  });

  it("returns skipped when no api key", async () => {
    setSettings({ apiKey: "" });
    const result = await captureConversation({
      conversationId: "conv-5",
      messages: MESSAGES,
      fetch: vi.fn(),
    });
    expect(result.skipped).toBe("no_api_key");
  });

  it("sends upload with correct payload for smart mode", async () => {
    setSettings({});
    let capturedBody: unknown;
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ id: "capture-abc" }), {
        status: 200,
      });
    });

    const result = await captureConversation({
      conversationId: "conv-smart",
      messages: MESSAGES,
      title: "Capital question",
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(result.captureId).toBe("capture-abc");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect((capturedBody as Record<string, unknown>).conversationId).toBe(
      "conv-smart",
    );
    const blob = JSON.parse(
      (capturedBody as Record<string, unknown>).blob as string,
    );
    expect(blob.privacy_mode).toBe("smart");
    expect(blob.messages).toHaveLength(2);
  });

  it("omits messages in private mode (topology only)", async () => {
    setSettings({ privacyMode: "private" });
    let capturedBlob: Record<string, unknown>;
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      capturedBlob = JSON.parse(body.blob);
      return new Response(null, { status: 204 });
    });

    await captureConversation({
      conversationId: "conv-private",
      messages: MESSAGES,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(capturedBlob!.messages).toBeUndefined();
    expect(capturedBlob!.privacy_mode).toBe("private");
  });

  it("redacts API keys in smart mode messages before upload", async () => {
    setSettings({});
    let capturedBlob: Record<string, unknown>;
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      capturedBlob = JSON.parse(body.blob);
      return new Response(JSON.stringify({ id: "cap-1" }), { status: 200 });
    });

    await captureConversation({
      conversationId: "conv-redact",
      messages: [
        { role: "user", content: "My key is sk-fakekey1234567890abcdef" },
      ],
      fetch: mockFetch as unknown as typeof fetch,
    });

    const msgs = capturedBlob!.messages as Array<{ content: string }>;
    expect(msgs[0].content).not.toContain("sk-fakekey");
    expect(msgs[0].content).toContain("[REDACTED]");
    expect(
      (capturedBlob!.redactions as Array<Record<string, unknown>>).length,
    ).toBeGreaterThan(0);
  });

  it("returns error on 401", async () => {
    setSettings({});
    const mockFetch = vi.fn(
      async () => new Response("Unauthorized", { status: 401 }),
    );

    const result = await captureConversation({
      conversationId: "conv-auth",
      messages: MESSAGES,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(result.error).toBe("unauthorized");
  });

  it("links prev_capture_record_id in chained captures", async () => {
    setSettings({});
    let capturedBlob: Record<string, unknown>;
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      capturedBlob = JSON.parse(body.blob);
      return new Response(JSON.stringify({ id: "cap-2" }), { status: 200 });
    });

    await captureConversation({
      conversationId: "conv-part2",
      messages: MESSAGES,
      prevCaptureRecordId: "conv-part1",
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(capturedBlob!.prev_capture_record_id).toBe("conv-part1");
  });
});
