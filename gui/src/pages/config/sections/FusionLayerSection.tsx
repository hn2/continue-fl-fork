import { useEffect, useState } from "react";
import { Card } from "../../../components/ui";
import {
  FusionLayerSettings,
  getLocalStorage,
  setLocalStorage,
} from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { UserSetting } from "../components/UserSetting";

const DEFAULT_SETTINGS: FusionLayerSettings = {
  enableRead: false,
  enableWrite: false,
  engineUrl: "https://api.fusionlayer.app",
  apiKey: "",
  privacyMode: "smart",
  maxArtifacts: 10,
  relevanceThreshold: 0.7,
  consentDate: null,
};

function loadSettings(): FusionLayerSettings {
  return { ...DEFAULT_SETTINGS, ...(getLocalStorage("fusionlayer_settings") ?? {}) };
}

export function FusionLayerSection() {
  const [settings, setSettings] = useState<FusionLayerSettings>(loadSettings);
  const [savedEngineUrl, setSavedEngineUrl] = useState(settings.engineUrl);

  useEffect(() => {
    setLocalStorage("fusionlayer_settings", settings);
  }, [settings]);

  function update(patch: Partial<FusionLayerSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  const isConnected = settings.apiKey.trim().length > 0;

  return (
    <div>
      <div className="flex flex-col">
        <ConfigHeader title="FusionLayer" />
        <div className="space-y-6">
          <div>
            <ConfigHeader title="Integration" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="toggle"
                  title="Enable read integration"
                  description="Reads relevant context from FusionLayer during conversations."
                  value={settings.enableRead}
                  onChange={(value) => update({ enableRead: value })}
                />
                <UserSetting
                  type="toggle"
                  title="Enable write integration"
                  description="Sends captured context to FusionLayer after conversations."
                  value={settings.enableWrite}
                  onChange={(value) => update({ enableWrite: value })}
                />
              </div>
            </Card>
          </div>

          <div>
            <ConfigHeader title="Connection" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="input"
                  title="Engine URL"
                  description="Base URL of the FusionLayer engine API."
                  value={settings.engineUrl}
                  onChange={(value) => update({ engineUrl: value })}
                  onSubmit={() => {
                    const trimmed = settings.engineUrl.trim();
                    update({ engineUrl: trimmed });
                    setSavedEngineUrl(trimmed);
                  }}
                  onCancel={() => update({ engineUrl: savedEngineUrl })}
                  isDirty={settings.engineUrl !== savedEngineUrl}
                  isValid={settings.engineUrl.trim().length > 0}
                />

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Authentication</span>
                    <div className="mt-0.5 text-xs text-gray-500">
                      API key for FusionLayer engine access.
                    </div>
                  </div>
                  {isConnected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-green-500">Connected</span>
                      <button
                        onClick={() => update({ apiKey: "" })}
                        className="border-command-border text-vsc-foreground rounded-md border border-solid px-2 py-1 text-xs hover:opacity-80"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex flex-row overflow-hidden rounded-md border border-solid focus-within:ring-1">
                      <input
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => update({ apiKey: e.target.value })}
                        placeholder="Enter API key"
                        className="text-vsc-foreground flex-1 border-none bg-inherit px-1.5 py-1 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div>
            <ConfigHeader title="Privacy" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="select"
                  title="Privacy mode"
                  description="Controls how much context is extracted and shared."
                  value={settings.privacyMode}
                  onChange={(value) =>
                    update({
                      privacyMode: value as FusionLayerSettings["privacyMode"],
                    })
                  }
                  options={[
                    { label: "Smart", value: "smart" },
                    { label: "Private", value: "private" },
                    { label: "Incognito", value: "incognito" },
                  ]}
                />
              </div>
            </Card>
          </div>

          <div>
            <ConfigHeader title="Query settings" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="number"
                  title="Max artifacts per query"
                  description="Maximum number of context artifacts to retrieve per query."
                  value={settings.maxArtifacts}
                  onChange={(value) => update({ maxArtifacts: value })}
                  min={1}
                  max={50}
                />
                <UserSetting
                  type="number"
                  title="Relevance threshold"
                  description="Minimum relevance score (0.0–1.0) for returned artifacts."
                  value={settings.relevanceThreshold}
                  onChange={(value) => update({ relevanceThreshold: value })}
                  min={0}
                  max={1}
                />
              </div>
            </Card>
          </div>

          <div>
            <ConfigHeader title="Consent" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-start gap-4">
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">Consent management</span>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {settings.consentDate
                        ? `Consented on ${settings.consentDate}`
                        : "Not consented"}
                    </div>
                  </div>
                  {settings.consentDate ? (
                    <button
                      onClick={() => update({ consentDate: null })}
                      className="border-command-border text-vsc-foreground rounded-md border border-solid px-2 py-1 text-xs hover:opacity-80"
                    >
                      Revoke consent
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        update({
                          consentDate: new Date().toISOString().split("T")[0],
                        })
                      }
                      className="border-command-border text-vsc-foreground rounded-md border border-solid px-2 py-1 text-xs hover:opacity-80"
                    >
                      Grant consent
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div>
            <ConfigHeader title="Status" variant="sm" />
            <Card>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500">Connection:</span>
                  <span>{isConnected ? "Connected" : "Not yet connected"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">Last sync:</span>
                  <span className="text-gray-400">Never</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
