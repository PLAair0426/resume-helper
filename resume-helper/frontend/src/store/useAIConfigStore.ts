import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isProviderConfigured, type AIModelType, type EndpointMode } from "@/config/ai";

export interface ProviderCredentials {
  apiKey: string;
  modelId: string;
  apiEndpoint: string;
  endpointMode: EndpointMode;
}

interface AIConfigState {
  selectedModel: AIModelType;
  providers: Record<string, ProviderCredentials>;
  setSelectedModel: (model: AIModelType) => void;
  setProviderField: (provider: AIModelType, field: keyof ProviderCredentials, value: string) => void;
  getCredentials: (provider?: AIModelType) => ProviderCredentials;
  isConfigured: () => boolean;
}

const EMPTY_CREDENTIALS: ProviderCredentials = {
  apiKey: "",
  modelId: "",
  apiEndpoint: "",
  endpointMode: "official",
};

const normalizeCredentials = (
  credentials?: Partial<ProviderCredentials> | null
): ProviderCredentials => ({
  ...EMPTY_CREDENTIALS,
  ...credentials,
  endpointMode:
    credentials?.endpointMode ||
    (credentials?.apiEndpoint ? "custom" : "official"),
});

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      selectedModel: "deepseek",
      providers: {},

      setSelectedModel: (model: AIModelType) => set({ selectedModel: model }),

      setProviderField: (provider, field, value) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...normalizeCredentials(state.providers[provider]),
              [field]: value,
            },
          },
        })),

      getCredentials: (provider) => {
        const state = get();
        const p = provider || state.selectedModel;
        return normalizeCredentials(state.providers[p]);
      },

      isConfigured: () => {
        const state = get();
        const creds = normalizeCredentials(state.providers[state.selectedModel]);
        return isProviderConfigured(state.selectedModel, creds);
      },
    }),
    {
      name: "ai-config-storage",
      version: 2,
      migrate: (persisted: unknown, version) => {
        const old = persisted as Record<string, unknown>;

        // Migrate from legacy flat fields without providers.
        if (old && !old.providers) {
          const providers: Record<string, ProviderCredentials> = {};
          if (old.doubaoApiKey || old.doubaoModelId) {
            providers.doubao = {
              apiKey: (old.doubaoApiKey as string) || "",
              modelId: (old.doubaoModelId as string) || "",
              apiEndpoint: "",
              endpointMode: "official",
            };
          }
          if (old.deepseekApiKey || old.deepseekModelId) {
            providers.deepseek = {
              apiKey: (old.deepseekApiKey as string) || "",
              modelId: (old.deepseekModelId as string) || "",
              apiEndpoint: "",
              endpointMode: "official",
            };
          }
          if (old.openaiApiKey || old.openaiModelId || old.openaiApiEndpoint) {
            const apiEndpoint = (old.openaiApiEndpoint as string) || "";
            providers.openai = {
              apiKey: (old.openaiApiKey as string) || "",
              modelId: (old.openaiModelId as string) || "",
              apiEndpoint,
              endpointMode: apiEndpoint ? "custom" : "official",
            };
          }
          return {
            selectedModel: (old.selectedModel as string) || "deepseek",
            providers,
          };
        }

        // Migrate from providers without endpointMode.
        if ((version ?? 0) < 2 && old?.providers) {
          const providers = old.providers as Record<string, Partial<ProviderCredentials>>;
          return {
            ...old,
            providers: Object.fromEntries(
              Object.entries(providers).map(([key, value]) => [
                key,
                normalizeCredentials(value),
              ])
            ),
          };
        }

        return old;
      },
    }
  )
);

