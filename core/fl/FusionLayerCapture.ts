import { isConsentGranted, loadSettings } from "./settings.js";
import { redactMessages, type Message } from "./redact.js";

const UPLOAD_TIMEOUT_MS = 10000;

interface CaptureOptions {
  conversationId: string;
  messages: Message[];
  title?: string;
  prevCaptureRecordId?: string | null;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface CaptureResult {
  captureId?: string;
  skipped?: string;
  error?: string;
}

export async function captureConversation(
  opts: CaptureOptions,
): Promise<CaptureResult> {
  const settings = loadSettings();

  if (!settings?.enableWrite) {
    return { skipped: "write_disabled" };
  }
  if (settings.privacyMode === "incognito") {
    return { skipped: "incognito" };
  }
  if (!isConsentGranted(settings)) {
    return { skipped: "consent_not_granted" };
  }
  if (!settings.apiKey) {
    return { skipped: "no_api_key" };
  }

  const isPrivate = settings.privacyMode === "private";
  let finalMessages: Message[] | undefined = opts.messages;
  let redactions: unknown[] = [];

  if (!isPrivate) {
    const result = redactMessages(opts.messages);
    finalMessages = result.messages;
    redactions = result.redactions;
  } else {
    finalMessages = undefined;
  }

  const blob = JSON.stringify({
    id: opts.conversationId,
    tool: "continue",
    privacy_mode: settings.privacyMode,
    ...(finalMessages !== undefined ? { messages: finalMessages } : {}),
    ...(redactions.length > 0 ? { redactions } : {}),
    created_at: new Date().toISOString(),
    prev_capture_record_id: opts.prevCaptureRecordId ?? null,
  });

  const payload = {
    conversationId: opts.conversationId,
    tool: "continue",
    title: opts.title?.slice(0, 120) ?? opts.conversationId,
    privacyLevel: "personal",
    storageMode: "standard",
    blob,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await opts.fetch(
      `${settings.engineUrl}/sync/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { error: "unauthorized" };
    }

    if (!response.ok) {
      return { error: `upload_failed:${response.status}` };
    }

    let captureId: string | undefined;
    try {
      const data = await response.json() as { id?: string; captureId?: string };
      captureId = data.id ?? data.captureId;
    } catch {
      // non-JSON response is ok (204 No Content)
    }

    return { captureId };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "timeout" };
    }
    console.debug("[FusionLayer] capture failed:", (err as Error).message);
    return { error: "network_error" };
  }
}
