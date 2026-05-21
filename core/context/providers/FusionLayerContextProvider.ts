import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

interface FusionLayerSettings {
  enabled: boolean;
  readEnabled: boolean;
  writeEnabled: boolean;
  engineUrl: string;
  apiKey?: string;
  privacyMode: "smart" | "private" | "incognito";
  maxArtifacts: number;
  relevanceThreshold: number;
  connectionStatus: "disconnected" | "connected" | "error";
  consent?: { granted_at?: string; revoked_at?: string };
}

const DEFAULT_ENGINE_URL = "https://api.fusionlayer.app";
const RETRIEVE_TIMEOUT_MS = 3000;

function loadSettings(): FusionLayerSettings | null {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("fusionlayer_settings")
        : null;
    if (!raw) return null;
    return JSON.parse(raw) as FusionLayerSettings;
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface ArtifactResult {
  id: string;
  title?: string;
  snippet?: string;
  created_at?: string;
  tool?: string;
}

class FusionLayerContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "fusionlayer",
    displayTitle: "FusionLayer Memory",
    description: "Surface relevant past conversations from FusionLayer memory",
    type: "query",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const settings = loadSettings();

    // Fall back to options if no localStorage settings (e.g., IDE-side call)
    const engineUrl =
      (settings?.engineUrl ?? (this.options as { engineUrl?: string })?.engineUrl) ||
      DEFAULT_ENGINE_URL;
    const apiKey =
      settings?.apiKey ?? (this.options as { apiKey?: string })?.apiKey;
    const maxArtifacts =
      settings?.maxArtifacts ??
      (this.options as { maxArtifacts?: number })?.maxArtifacts ??
      10;

    // Guard: disabled or privacy mode blocks read
    if (settings) {
      if (!settings.enabled || !settings.readEnabled) return [];
      if (settings.privacyMode === "incognito") return [];
    }

    if (!apiKey) return [];

    const url = `${engineUrl}/context/retrieve?q=${encodeURIComponent(query)}&limit=${maxArtifacts}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        RETRIEVE_TIMEOUT_MS,
      );

      const response = await extras.fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Update connection status in localStorage
        if (typeof localStorage !== "undefined" && settings) {
          localStorage.setItem(
            "fusionlayer_settings",
            JSON.stringify({ ...settings, connectionStatus: "error" }),
          );
        }
        return [];
      }

      if (!response.ok) return [];

      const data = (await response.json()) as {
        artifacts?: ArtifactResult[];
        context?: ArtifactResult[];
        conversations?: ArtifactResult[];
      };

      const artifacts: ArtifactResult[] =
        data.artifacts ?? data.context ?? data.conversations ?? [];

      return artifacts.map((artifact) => ({
        name: artifact.title ?? artifact.id,
        description: `${artifact.tool ?? "continue"} — ${formatDate(artifact.created_at ?? "")}`,
        content: artifact.snippet ?? "",
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.debug("[FusionLayer] engine unreachable:", err.message);
      }
      return [];
    }
  }
}

export default FusionLayerContextProvider;
