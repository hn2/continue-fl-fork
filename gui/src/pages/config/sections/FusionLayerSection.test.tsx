import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as localStorageUtil from "../../../util/localStorage";
import { FusionLayerSettings } from "../../../util/localStorage";
import { FusionLayerSection } from "./FusionLayerSection";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../util/localStorage", async () => {
  const actual = await vi.importActual("../../../util/localStorage");
  return {
    ...actual,
    getLocalStorage: vi.fn(),
    setLocalStorage: vi.fn(),
  };
});

const mockGetLocalStorage = vi.mocked(localStorageUtil.getLocalStorage);
const mockSetLocalStorage = vi.mocked(localStorageUtil.setLocalStorage);

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

describe("FusionLayerSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocalStorage.mockReturnValue(undefined);
  });

  const renderComponent = () =>
    act(async () => render(<FusionLayerSection />));

  describe("settings load from localStorage", () => {
    it("shows default values when no settings are stored", async () => {
      await renderComponent();
      expect(screen.getByText("FusionLayer")).toBeInTheDocument();
      expect(screen.getByText("Engine URL")).toBeInTheDocument();
      expect(screen.getByText("Privacy mode")).toBeInTheDocument();
    });

    it("loads stored settings from localStorage on mount", async () => {
      const stored: FusionLayerSettings = {
        ...DEFAULT_SETTINGS,
        enableRead: true,
        apiKey: "test-key-123",
        privacyMode: "private",
        consentDate: "2026-01-01",
      };
      mockGetLocalStorage.mockReturnValue(stored as any);

      await renderComponent();

      expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
      expect(screen.getByText("Consented on 2026-01-01")).toBeInTheDocument();
    });

    it("shows Not consented when consentDate is null", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();
      expect(screen.getByText("Not consented")).toBeInTheDocument();
    });

    it("shows Not yet connected status when no API key stored", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();
      expect(screen.getByText("Not yet connected")).toBeInTheDocument();
    });
  });

  describe("toggle read integration updates localStorage", () => {
    it("calls setLocalStorage with enableRead true when toggled on", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();

      const readSettingRow = screen
        .getByText("Enable read integration")
        .closest("div[class*='flex items-start']");
      const toggleDiv = readSettingRow?.querySelector(
        "div[class*='rounded-full']",
      );

      await act(async () => {
        fireEvent.click(toggleDiv!);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "fusionlayer_settings",
        expect.objectContaining({ enableRead: true }),
      );
    });

    it("calls setLocalStorage with enableWrite true when write toggle is toggled on", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();

      const writeSettingRow = screen
        .getByText("Enable write integration")
        .closest("div[class*='flex items-start']");
      const toggleDiv = writeSettingRow?.querySelector(
        "div[class*='rounded-full']",
      );

      await act(async () => {
        fireEvent.click(toggleDiv!);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "fusionlayer_settings",
        expect.objectContaining({ enableWrite: true }),
      );
    });
  });

  describe("revoke consent clears consent fields", () => {
    it("revoke consent button sets consentDate to null", async () => {
      const stored: FusionLayerSettings = {
        ...DEFAULT_SETTINGS,
        consentDate: "2026-01-01",
      };
      mockGetLocalStorage.mockReturnValue(stored as any);

      await renderComponent();

      const revokeButton = screen.getByRole("button", {
        name: /revoke consent/i,
      });

      await act(async () => {
        fireEvent.click(revokeButton);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "fusionlayer_settings",
        expect.objectContaining({ consentDate: null }),
      );
    });

    it("shows Grant consent button when no consent date is set", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();

      expect(
        screen.getByRole("button", { name: /grant consent/i }),
      ).toBeInTheDocument();
    });

    it("grant consent button sets consentDate to today", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();

      const grantButton = screen.getByRole("button", {
        name: /grant consent/i,
      });

      await act(async () => {
        fireEvent.click(grantButton);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "fusionlayer_settings",
        expect.objectContaining({
          consentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });
  });

  describe("authentication", () => {
    it("shows API key input when no key is stored", async () => {
      mockGetLocalStorage.mockReturnValue(undefined);
      await renderComponent();

      expect(
        screen.getByPlaceholderText("Enter API key"),
      ).toBeInTheDocument();
    });

    it("shows Connected status and Disconnect button when API key is set", async () => {
      const stored: FusionLayerSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: "my-secret-key",
      };
      mockGetLocalStorage.mockReturnValue(stored as any);

      await renderComponent();

      expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });

    it("disconnect button clears the API key", async () => {
      const stored: FusionLayerSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: "my-secret-key",
      };
      mockGetLocalStorage.mockReturnValue(stored as any);

      await renderComponent();

      const disconnectButton = screen.getByRole("button", {
        name: /disconnect/i,
      });

      await act(async () => {
        fireEvent.click(disconnectButton);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "fusionlayer_settings",
        expect.objectContaining({ apiKey: "" }),
      );
    });
  });
});
