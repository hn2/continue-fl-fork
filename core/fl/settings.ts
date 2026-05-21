export interface FusionLayerSettings {
  enableRead: boolean;
  enableWrite: boolean;
  engineUrl: string;
  apiKey: string;
  privacyMode: "smart" | "private" | "incognito";
  maxArtifacts: number;
  relevanceThreshold: number;
  consentDate: string | null;
}

export const STORAGE_KEY = "fusionlayer_settings";

export const DEFAULT_SETTINGS: FusionLayerSettings = {
  enableRead: false,
  enableWrite: false,
  engineUrl: "https://api.fusionlayer.app",
  apiKey: "",
  privacyMode: "smart",
  maxArtifacts: 10,
  relevanceThreshold: 0.7,
  consentDate: null,
};

export function loadSettings(): FusionLayerSettings | null {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (!raw) return null;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<FusionLayerSettings>) };
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
  return !!(settings?.consentDate);
}
