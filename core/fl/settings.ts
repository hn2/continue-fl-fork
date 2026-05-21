export interface FusionLayerSettings {
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

export const STORAGE_KEY = "fusionlayer_settings";

export const DEFAULT_SETTINGS: FusionLayerSettings = {
  enabled: false,
  readEnabled: true,
  writeEnabled: true,
  engineUrl: "https://api.fusionlayer.app",
  privacyMode: "smart",
  maxArtifacts: 10,
  relevanceThreshold: 0.7,
  connectionStatus: "disconnected",
};

export function loadSettings(): FusionLayerSettings | null {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (!raw) return null;
    return JSON.parse(raw) as FusionLayerSettings;
  } catch {
    return null;
  }
}

export function saveSettings(patch: Partial<FusionLayerSettings>): void {
  if (typeof localStorage === "undefined") return;
  const current = loadSettings() ?? DEFAULT_SETTINGS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function isConsentGranted(settings: FusionLayerSettings | null): boolean {
  if (!settings?.consent?.granted_at) return false;
  if (settings.consent.revoked_at) {
    return (
      new Date(settings.consent.granted_at) >
      new Date(settings.consent.revoked_at)
    );
  }
  return true;
}
