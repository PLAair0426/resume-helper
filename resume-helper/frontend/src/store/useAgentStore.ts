/**
 * Agent state: JD analysis, ATS audit, keyword coverage, optimization, and auto-fill.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  JDAnalysis,
  CoverageResult,
  ATSScorecard,
  AgentResponse,
  OptimizeResult,
  AutoFillResult,
} from "@/types/agent";
import type { ResumeData } from "@/types/resume";
import { toResumeProfile } from "@/lib/profileConverter";
import {
  AI_PROVIDERS,
  getEffectiveEndpoint,
  getModelId,
  type AIModelType,
} from "@/config/ai";
import { LOCAL_CONFIG_ENABLED } from "@/config/deployment";
import { useAIConfigStore } from "./useAIConfigStore";

function extractAgentError(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  const payload = json as Record<string, unknown>;
  const message =
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.detail === "string" && payload.detail) ||
    (typeof payload.error === "string" && payload.error);
  return message || fallback;
}

async function ensureAICredentials(): Promise<{
  api_key: string;
  provider: string;
  model?: string;
  api_endpoint?: string;
} | null> {
  const store = useAIConfigStore.getState();
  const selected = store.selectedModel;
  const configProvider: AIModelType = selected;
  const selectedCreds = store.getCredentials(selected);
  let creds = store.getCredentials(configProvider);
  const hasCodexLeak =
    configProvider !== "codex" && /codex/i.test(creds.modelId || "");

  if (LOCAL_CONFIG_ENABLED && (!creds.apiKey?.trim() || hasCodexLeak)) {
    const providerMeta = AI_PROVIDERS[configProvider];

    try {
      const res = await fetch("/api/local-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: configProvider,
          defaultEndpoint: providerMeta.defaultEndpoint,
          defaultModel: providerMeta.defaultModel || "",
        }),
      });

      const json = (await res.json()) as {
        status?: string;
        data?: {
          apiKey?: string;
          modelId?: string;
          apiEndpoint?: string;
          endpointMode?: "official" | "custom";
        };
      };

      if (res.ok && json.status === "ok" && json.data) {
        const local = json.data;
        // Only write to store if local config actually found an API key;
        // writing empty values would poison the store entry.
        if (local.apiKey?.trim()) {
          store.setProviderField(configProvider, "apiKey", local.apiKey);
          store.setProviderField(configProvider, "modelId", local.modelId || "");
          store.setProviderField(configProvider, "apiEndpoint", local.apiEndpoint || "");
          if (local.endpointMode) {
            store.setProviderField(configProvider, "endpointMode", local.endpointMode);
          }
        }
        creds = useAIConfigStore.getState().getCredentials(configProvider);
      }
    } catch {
      // ignore local-config read failure and keep current credentials
    }
  }

  if (!creds.apiKey?.trim()) return null;

  const model = getModelId(selected, selectedCreds.modelId || creds.modelId);
  const endpointSource =
    selected === "codex" && selectedCreds.endpointMode === "custom"
      ? selectedCreds
      : creds;
  const endpointProvider: AIModelType = selected === "codex" ? "codex" : configProvider;
  const endpoint = getEffectiveEndpoint(endpointProvider, endpointSource);
  const useCustomEndpoint = endpointSource.endpointMode === "custom";
  const backendProvider =
    configProvider === "deepseek"
      ? "deepseek"
      : configProvider === "anthropic"
        ? "anthropic"
        : "openai";

  if (backendProvider === "deepseek") {
    return {
      api_key: creds.apiKey,
      provider: "deepseek",
      model,
      ...(useCustomEndpoint ? { api_endpoint: endpoint } : {}),
    };
  }

  if (backendProvider === "anthropic") {
    return {
      api_key: creds.apiKey,
      provider: "anthropic",
      model,
      api_endpoint: endpoint,
    };
  }

  return {
    api_key: creds.apiKey,
    provider: "openai",
    model,
    api_endpoint: endpoint,
  };
}

interface AgentState {
  agentApiUrl: string;
  agentConnected: boolean;

  jdText: string;
  jobTitle: string;
  jdAnalysis: JDAnalysis | null;
  jdLoading: boolean;

  coverage: CoverageResult | null;
  coverageLoading: boolean;

  atsScorecard: ATSScorecard | null;
  atsLoading: boolean;

  optimizeResult: OptimizeResult | null;
  optimizeLoading: boolean;

  autoFillResult: AutoFillResult | null;
  autoFillLoading: boolean;

  lastError: string | null;

  setJDText: (text: string) => void;
  setJobTitle: (title: string) => void;
  setAgentApiUrl: (url: string) => void;

  checkConnection: () => Promise<boolean>;
  analyzeJD: () => Promise<void>;
  calculateCoverage: (resumeData: ResumeData) => Promise<void>;
  runATSAudit: (resumeData: ResumeData) => Promise<void>;
  optimizeContent: (resumeData: ResumeData) => Promise<void>;
  autoFillFromText: (
    resumeText: string,
    templateId?: string | null
  ) => Promise<AutoFillResult | null>;
  clearResults: () => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agentApiUrl: "http://localhost:8000",
      agentConnected: false,

      jdText: "",
      jobTitle: "",
      jdAnalysis: null,
      jdLoading: false,

      coverage: null,
      coverageLoading: false,

      atsScorecard: null,
      atsLoading: false,

      optimizeResult: null,
      optimizeLoading: false,

      autoFillResult: null,
      autoFillLoading: false,

      lastError: null,

      setJDText: (text) => set({ jdText: text }),
      setJobTitle: (title) => set({ jobTitle: title }),
      setAgentApiUrl: (url) => set({ agentApiUrl: url }),

      checkConnection: async () => {
        try {
          const res = await fetch(`${get().agentApiUrl}/health`);
          const ok = res.ok;
          set({ agentConnected: ok });
          return ok;
        } catch {
          set({ agentConnected: false });
          return false;
        }
      },

      analyzeJD: async () => {
        const { jdText } = get();
        if (!jdText.trim()) return;

        const creds = await ensureAICredentials();
        if (!creds) {
          set({ lastError: "Please configure AI API Key in settings" });
          return;
        }

        set({ jdLoading: true, lastError: null });
        try {
          const res = await fetch("/api/agent/analyze-jd", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jd_text: jdText,
              keywords: [],
              ...creds,
            }),
          });
          const json: AgentResponse<JDAnalysis> = await res.json();
          if (json.status === "ok" && json.data) {
            set({ jdAnalysis: json.data, jdLoading: false });
          } else {
            set({
              lastError: extractAgentError(json, "JD analysis failed"),
              jdLoading: false,
            });
          }
        } catch (e) {
          set({
            lastError: `JD analysis request failed: ${e}`,
            jdLoading: false,
          });
        }
      },

      calculateCoverage: async (resumeData) => {
        const { jdAnalysis } = get();
        if (!jdAnalysis) return;

        const creds = await ensureAICredentials();
        if (!creds) {
          set({ lastError: "Please configure AI API Key in settings" });
          return;
        }

        set({ coverageLoading: true, lastError: null });
        try {
          const profile = toResumeProfile(resumeData);
          const res = await fetch("/api/agent/coverage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile,
              jd_analysis: jdAnalysis,
              ...creds,
            }),
          });
          const json: AgentResponse<CoverageResult> = await res.json();
          if (json.status === "ok" && json.data) {
            set({ coverage: json.data, coverageLoading: false });
          } else {
            set({
              lastError: extractAgentError(json, "Coverage calculation failed"),
              coverageLoading: false,
            });
          }
        } catch (e) {
          set({
            lastError: `Coverage request failed: ${e}`,
            coverageLoading: false,
          });
        }
      },

      runATSAudit: async (resumeData) => {
        const creds = await ensureAICredentials();
        if (!creds) {
          set({ lastError: "Please configure AI API Key in settings" });
          return;
        }

        set({ atsLoading: true, lastError: null });
        try {
          const profile = toResumeProfile(resumeData);
          const content = JSON.stringify(profile, null, 2);

          const res = await fetch("/api/agent/ats-audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resume_content: content,
              format_type: "json",
              ...creds,
            }),
          });
          const json: AgentResponse<ATSScorecard> = await res.json();
          if (json.status === "ok" && json.data) {
            set({ atsScorecard: json.data, atsLoading: false });
          } else {
            set({
              lastError: extractAgentError(json, "ATS audit failed"),
              atsLoading: false,
            });
          }
        } catch (e) {
          set({
            lastError: `ATS audit request failed: ${e}`,
            atsLoading: false,
          });
        }
      },

      optimizeContent: async (resumeData) => {
        const { jdText, jobTitle } = get();
        if (!jdText.trim()) return;

        const creds = await ensureAICredentials();
        if (!creds) {
          set({ lastError: "Please configure AI API Key in settings" });
          return;
        }

        set({ optimizeLoading: true, lastError: null });
        try {
          const profile = toResumeProfile(resumeData);
          const res = await fetch("/api/agent/optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile,
              jd_text: jdText,
              job_title: jobTitle,
              ...creds,
            }),
          });
          const json: AgentResponse<OptimizeResult> = await res.json();
          if (json.status === "ok" && json.data) {
            set({ optimizeResult: json.data, optimizeLoading: false });
          } else {
            set({
              lastError: extractAgentError(json, "Content optimization failed"),
              optimizeLoading: false,
            });
          }
        } catch (e) {
          set({
            lastError: `Content optimization request failed: ${e}`,
            optimizeLoading: false,
          });
        }
      },

      autoFillFromText: async (resumeText, templateId) => {
        if (!resumeText.trim()) return null;

        const creds = await ensureAICredentials();
        if (!creds) {
          set({ lastError: "Please configure AI API Key in settings" });
          return null;
        }

        set({ autoFillLoading: true, lastError: null });
        try {
          const res = await fetch("/api/agent/autofill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resume_text: resumeText,
              target_template: templateId || null,
              ...creds,
            }),
          });
          const json: AgentResponse<AutoFillResult> = await res.json();
          if (json.status === "ok" && json.data) {
            set({ autoFillResult: json.data, autoFillLoading: false });
            return json.data;
          }

          set({
            lastError: extractAgentError(json, "AI autofill failed"),
            autoFillLoading: false,
          });
          return null;
        } catch (e) {
          set({
            lastError: `AI autofill request failed: ${e}`,
            autoFillLoading: false,
          });
          return null;
        }
      },

      clearResults: () =>
        set({
          jdAnalysis: null,
          coverage: null,
          atsScorecard: null,
          optimizeResult: null,
          autoFillResult: null,
          autoFillLoading: false,
          lastError: null,
        }),
    }),
    {
      name: "agent-store",
      partialize: (state) => ({
        agentApiUrl: state.agentApiUrl,
        jdText: state.jdText,
        jobTitle: state.jobTitle,
      }),
    }
  )
);
