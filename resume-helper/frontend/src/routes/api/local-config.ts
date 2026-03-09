import { createFileRoute } from "@tanstack/react-router";
import { AI_PROVIDERS, AI_PROVIDER_IDS, type AIModelType } from "@/config/ai";
import { isServerLocalConfigEnabled } from "@/config/deployment";

interface LocalConfigRequestBody {
  provider?: string;
  defaultEndpoint?: string;
  defaultModel?: string;
}

async function safeReadRequestBody(
  request: Request
): Promise<LocalConfigRequestBody | null> {
  const raw = await request.text();
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as LocalConfigRequestBody;
    }
    return null;
  } catch {
    return null;
  }
}

interface LocalConfigNodeModules {
  fs: typeof import("node:fs/promises");
  os: typeof import("node:os");
  path: typeof import("node:path");
}

let localConfigNodeModulesPromise: Promise<LocalConfigNodeModules> | null = null;

async function getLocalConfigNodeModules(): Promise<LocalConfigNodeModules> {
  if (!localConfigNodeModulesPromise) {
    localConfigNodeModulesPromise = Promise.all([
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
    ]).then(([fs, os, path]) => ({ fs, os, path }));
  }

  return localConfigNodeModulesPromise;
}

interface LocalConfigData {
  apiKey: string;
  modelId: string;
  apiEndpoint: string;
  endpointMode: "official" | "custom";
  source: string[];
}

interface ProviderAliasConfig {
  apiKeys: string[];
  baseUrls: string[];
  models: string[];
  tomlProviders?: string[];
}

const GENERIC_API_KEY_ALIASES = ["OPENAI_API_KEY", "API_KEY"];
const GENERIC_BASE_URL_ALIASES = ["OPENAI_BASE_URL", "BASE_URL", "API_BASE_URL"];
const GENERIC_MODEL_ALIASES = ["OPENAI_MODEL", "MODEL"];
const LOCAL_CONFIG_JSON_ENV = "LOCAL_CONFIG_JSON_PATH";
const JSON_PROVIDER_KEY_FIELDS = ["apikey", "api_key", "api-key", "key", "token"];
const JSON_PROVIDER_MODEL_FIELDS = [
  "modelid",
  "model_id",
  "model-id",
  "model",
  "defaultmodel",
  "default_model",
];
const JSON_PROVIDER_ENDPOINT_FIELDS = [
  "apiendpoint",
  "api_endpoint",
  "api-endpoint",
  "baseurl",
  "base_url",
  "endpoint",
  "url",
];
const JSON_PROVIDER_MODE_FIELDS = [
  "endpointmode",
  "endpoint_mode",
  "baseurlmode",
  "base_url_mode",
  "mode",
];

function allowGenericAliases(provider: AIModelType): boolean {
  return provider === "openai" || provider === "codex";
}

const PROVIDER_ALIAS_MAP: Record<AIModelType, ProviderAliasConfig> = {
  deepseek: {
    apiKeys: ["DEEPSEEK_API_KEY"],
    baseUrls: ["DEEPSEEK_BASE_URL"],
    models: ["DEEPSEEK_MODEL"],
  },
  doubao: {
    apiKeys: ["DOUBAO_API_KEY", "ARK_API_KEY", "VOLCENGINE_API_KEY"],
    baseUrls: ["DOUBAO_BASE_URL", "ARK_BASE_URL", "VOLCENGINE_BASE_URL"],
    models: ["DOUBAO_MODEL", "ARK_MODEL"],
  },
  openai: {
    apiKeys: ["OPENAI_API_KEY", "OPENAI_AUTH_TOKEN"],
    baseUrls: ["OPENAI_BASE_URL"],
    models: ["OPENAI_MODEL", "GPT_MODEL"],
    tomlProviders: ["openai"],
  },
  codex: {
    apiKeys: ["OPENAI_API_KEY", "CODEX_API_KEY"],
    baseUrls: ["OPENAI_BASE_URL", "CODEX_BASE_URL"],
    models: ["CODEX_MODEL", "OPENAI_MODEL"],
    tomlProviders: ["codex", "openai"],
  },
  anthropic: {
    apiKeys: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
    baseUrls: ["ANTHROPIC_BASE_URL"],
    models: ["ANTHROPIC_MODEL", "CLAUDE_MODEL"],
    tomlProviders: ["anthropic", "claude"],
  },
  gemini: {
    apiKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseUrls: ["GEMINI_BASE_URL", "GOOGLE_BASE_URL"],
    models: ["GEMINI_MODEL", "GOOGLE_MODEL"],
    tomlProviders: ["gemini", "google"],
  },
  qwen: {
    apiKeys: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
    baseUrls: ["QWEN_BASE_URL", "DASHSCOPE_BASE_URL"],
    models: ["QWEN_MODEL"],
  },
  zhipu: {
    apiKeys: ["ZHIPU_API_KEY", "BIGMODEL_API_KEY"],
    baseUrls: ["ZHIPU_BASE_URL", "BIGMODEL_BASE_URL"],
    models: ["ZHIPU_MODEL", "GLM_MODEL"],
  },
  moonshot: {
    apiKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    baseUrls: ["MOONSHOT_BASE_URL", "KIMI_BASE_URL"],
    models: ["MOONSHOT_MODEL", "KIMI_MODEL"],
  },
  baichuan: {
    apiKeys: ["BAICHUAN_API_KEY"],
    baseUrls: ["BAICHUAN_BASE_URL"],
    models: ["BAICHUAN_MODEL"],
  },
  yi: {
    apiKeys: ["YI_API_KEY", "LINGYIWANWU_API_KEY"],
    baseUrls: ["YI_BASE_URL", "LINGYIWANWU_BASE_URL"],
    models: ["YI_MODEL"],
  },
  minimax: {
    apiKeys: ["MINIMAX_API_KEY"],
    baseUrls: ["MINIMAX_BASE_URL"],
    models: ["MINIMAX_MODEL"],
  },
  spark: {
    apiKeys: ["SPARK_API_KEY", "XFYUN_API_KEY"],
    baseUrls: ["SPARK_BASE_URL", "XFYUN_BASE_URL"],
    models: ["SPARK_MODEL"],
  },
  stepfun: {
    apiKeys: ["STEPFUN_API_KEY"],
    baseUrls: ["STEPFUN_BASE_URL"],
    models: ["STEPFUN_MODEL"],
  },
  siliconflow: {
    apiKeys: ["SILICONFLOW_API_KEY"],
    baseUrls: ["SILICONFLOW_BASE_URL"],
    models: ["SILICONFLOW_MODEL"],
  },
  groq: {
    apiKeys: ["GROQ_API_KEY"],
    baseUrls: ["GROQ_BASE_URL"],
    models: ["GROQ_MODEL"],
  },
  mistral: {
    apiKeys: ["MISTRAL_API_KEY"],
    baseUrls: ["MISTRAL_BASE_URL"],
    models: ["MISTRAL_MODEL"],
  },
};

function isProviderId(provider: string): provider is AIModelType {
  return AI_PROVIDER_IDS.includes(provider as AIModelType);
}

function normalizeAliasKey(key: string): string {
  return key.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqAliases(...aliasGroups: string[][]): string[] {
  return Array.from(
    new Set(aliasGroups.flat().map((item) => normalizeAliasKey(item)))
  );
}

function findTomlString(content: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*${escapedKey}\\s*=\\s*"([^"]*)"\\s*$`, "m")
  );
  return match?.[1]?.trim() || "";
}

function findTomlStringInSection(
  content: string,
  sectionName: string,
  key: string
): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyRegex = new RegExp(`^\\s*${escapedKey}\\s*=\\s*"([^"]*)"\\s*$`);
  const lines = content.split(/\r?\n/);
  let inTargetSection = false;

  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      inTargetSection = sectionMatch[1].trim() === sectionName;
      continue;
    }

    if (!inTargetSection) {
      continue;
    }

    const valueMatch = line.match(keyRegex);
    if (valueMatch?.[1]?.trim()) {
      return valueMatch[1].trim();
    }
  }

  return "";
}

async function readFileIfExists(filePath: string): Promise<string> {
  try {
    const { fs } = await getLocalConfigNodeModules();
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function toEnvRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string" && rawValue.trim()) {
      output[normalizeAliasKey(key)] = rawValue.trim();
    }
  }

  return output;
}

function toJsonFieldRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string" && rawValue.trim()) {
      output[key.trim().toLowerCase().replace(/[\s_-]+/g, "")] = rawValue.trim();
    }
  }

  return output;
}

function pickJsonFieldValue(record: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = record[alias];
    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function toEndpointMode(
  endpointMode: string,
  apiEndpoint: string,
  defaultEndpoint: string
): "official" | "custom" {
  const normalizedMode = endpointMode.trim().toLowerCase();
  if (normalizedMode === "official" || normalizedMode === "custom") {
    return normalizedMode;
  }

  return normalizeEndpoint(apiEndpoint) &&
    normalizeEndpoint(apiEndpoint) !== normalizeEndpoint(defaultEndpoint)
    ? "custom"
    : "official";
}

async function resolveLocalConfigJsonPaths(): Promise<string[]> {
  const { path } = await getLocalConfigNodeModules();
  const cwd = process.cwd();
  const overridePath =
    typeof process !== "undefined" ? process.env?.[LOCAL_CONFIG_JSON_ENV]?.trim() || "" : "";

  return Array.from(
    new Set(
      [
        overridePath ? path.resolve(overridePath) : "",
        path.resolve(cwd, "local-config.json"),
        path.resolve(cwd, "frontend", "local-config.json"),
        path.resolve(cwd, "resume-helper", "frontend", "local-config.json"),
      ].filter(Boolean)
    )
  );
}

function extractJsonConfigSection(
  parsed: Record<string, unknown>,
  provider: AIModelType
): Record<string, unknown> | null {
  const providers = isRecord(parsed.providers) ? parsed.providers : null;
  if (providers && isRecord(providers[provider])) {
    return providers[provider];
  }

  if (isRecord(parsed[provider])) {
    return parsed[provider];
  }

  return null;
}

async function readJsonLocalConfigByProvider(
  provider: AIModelType,
  keyAliases: string[],
  modelAliases: string[],
  endpointAliases: string[],
  defaultModel: string,
  defaultEndpoint: string
): Promise<LocalConfigData | null> {
  const candidatePaths = await resolveLocalConfigJsonPaths();

  for (const filePath of candidatePaths) {
    const raw = await readFileIfExists(filePath);
    if (!raw.trim()) {
      continue;
    }

    const parsed = parseJsonRecord(raw);
    const providerSection = extractJsonConfigSection(parsed, provider);
    const providerJsonFields = toJsonFieldRecord(providerSection);
    const providerEnvFields = toEnvRecord(providerSection);
    const rootEnvFields = toEnvRecord(parsed);

    const sectionApiKey =
      pickJsonFieldValue(providerJsonFields, JSON_PROVIDER_KEY_FIELDS) ||
      pickFirstValue(providerEnvFields, keyAliases);
    const sectionModelId =
      pickJsonFieldValue(providerJsonFields, JSON_PROVIDER_MODEL_FIELDS) ||
      pickFirstValue(providerEnvFields, modelAliases);
    const sectionEndpoint =
      pickJsonFieldValue(providerJsonFields, JSON_PROVIDER_ENDPOINT_FIELDS) ||
      pickFirstValue(providerEnvFields, endpointAliases);
    const sectionMode = pickJsonFieldValue(providerJsonFields, JSON_PROVIDER_MODE_FIELDS);

    const rootApiKey = pickFirstValue(rootEnvFields, keyAliases);
    const rootModelId = pickFirstValue(rootEnvFields, modelAliases);
    const rootEndpoint = pickFirstValue(rootEnvFields, endpointAliases);

    const apiKey = sectionApiKey || rootApiKey;
    const modelId = sectionModelId || rootModelId || defaultModel;
    const apiEndpoint = sectionEndpoint || rootEndpoint || defaultEndpoint;
    const endpointMode = toEndpointMode(sectionMode, apiEndpoint, defaultEndpoint);

    const hasConfig =
      Boolean(providerSection) ||
      Boolean(apiKey) ||
      Boolean(sectionModelId) ||
      Boolean(rootModelId) ||
      Boolean(sectionEndpoint) ||
      Boolean(rootEndpoint) ||
      Boolean(sectionMode);

    if (!hasConfig) {
      continue;
    }

    return {
      apiKey,
      modelId,
      apiEndpoint,
      endpointMode,
      source: [filePath],
    };
  }

  return null;
}

function pickFirstValue(
  envRecord: Record<string, string>,
  aliases: string[]
): string {
  for (const alias of aliases) {
    const value = envRecord[normalizeAliasKey(alias)];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function readLocalConfigByProvider(
  provider: AIModelType,
  inputDefaults: Pick<LocalConfigRequestBody, "defaultEndpoint" | "defaultModel">
): Promise<LocalConfigData> {
  const { os, path } = await getLocalConfigNodeModules();
  const home = os.homedir();
  const codexConfigPath = path.join(home, ".codex", "config.toml");
  const codexAuthPath = path.join(home, ".codex", "auth.json");
  const claudeSettingsPath = path.join(home, ".claude", "settings.json");

  const sources: string[] = [];

  const codexTomlRaw = await readFileIfExists(codexConfigPath);
  const codexAuthRaw = await readFileIfExists(codexAuthPath);
  const claudeSettingsRaw = await readFileIfExists(claudeSettingsPath);

  const providerMeta = AI_PROVIDERS[provider];
  const defaultModel = inputDefaults.defaultModel?.trim() || providerMeta.defaultModel || "";
  const defaultEndpoint =
    inputDefaults.defaultEndpoint?.trim() || providerMeta.defaultEndpoint;

  const providerAliases = PROVIDER_ALIAS_MAP[provider];
  const genericAliasesEnabled = allowGenericAliases(provider);
  const modelAliases = uniqAliases(
    providerAliases.models,
    [`${provider}_MODEL`],
    ...(genericAliasesEnabled ? [GENERIC_MODEL_ALIASES] : [])
  );
  const keyAliases = uniqAliases(
    providerAliases.apiKeys,
    [`${provider}_API_KEY`],
    ...(genericAliasesEnabled ? [GENERIC_API_KEY_ALIASES] : [])
  );
  const endpointAliases = uniqAliases(
    providerAliases.baseUrls,
    [`${provider}_BASE_URL`, `${provider}_API_ENDPOINT`],
    ...(genericAliasesEnabled ? [GENERIC_BASE_URL_ALIASES] : [])
  );

  let modelId = defaultModel;
  let apiEndpoint = defaultEndpoint;
  let apiKey = "";

  const jsonConfig = await readJsonLocalConfigByProvider(
    provider,
    keyAliases,
    modelAliases,
    endpointAliases,
    defaultModel,
    defaultEndpoint
  );

  if (jsonConfig) {
    sources.push(...jsonConfig.source);
    apiKey = jsonConfig.apiKey || apiKey;
    modelId = jsonConfig.modelId || modelId;
    apiEndpoint = jsonConfig.apiEndpoint || apiEndpoint;
  }

  if (codexTomlRaw) {
    const providerCandidates = Array.from(
      new Set([provider, ...(providerAliases.tomlProviders || [])])
    );
    let codexTomlUsed = false;

    for (const tomlProvider of providerCandidates) {
      const sectionEndpoint = findTomlStringInSection(
        codexTomlRaw,
        `model_providers.${tomlProvider}`,
        "base_url"
      );
      if (sectionEndpoint.trim()) {
        apiEndpoint = sectionEndpoint.trim();
        codexTomlUsed = true;
        break;
      }
    }

    const configuredProvider = findTomlString(codexTomlRaw, "model_provider")
      .trim()
      .toLowerCase();
    const configuredModel = findTomlString(codexTomlRaw, "model").trim();
    if (
      configuredModel &&
      configuredProvider &&
      providerCandidates.includes(configuredProvider)
    ) {
      modelId = configuredModel;
      codexTomlUsed = true;
    }

    if (codexTomlUsed) {
      sources.push(codexConfigPath);
    }
  }

  if (codexAuthRaw) {
    // Avoid leaking codex auth into other providers (e.g. OpenAI),
    // because auth.json may not contain a valid API key for them.
    if (provider === "codex") {
      const authRecord = toEnvRecord(parseJsonRecord(codexAuthRaw));
      let codexAuthUsed = false;

      if (!apiKey) {
        const authApiKey = pickFirstValue(authRecord, keyAliases);
        if (authApiKey) {
          apiKey = authApiKey;
          codexAuthUsed = true;
        }
      }

      if (!modelId) {
        const authModelId = pickFirstValue(authRecord, modelAliases);
        if (authModelId) {
          modelId = authModelId;
          codexAuthUsed = true;
        }
      }

      if (codexAuthUsed) {
        sources.push(codexAuthPath);
      }
    }
  }

  if (claudeSettingsRaw) {
    const settingsJson = parseJsonRecord(claudeSettingsRaw);
    const settingsEnv = toEnvRecord(settingsJson.env);
    const settingsTopLevel = toEnvRecord(settingsJson);
    const mergedEnv = { ...settingsTopLevel, ...settingsEnv };
    let claudeSettingsUsed = false;

    if (!apiKey) {
      const settingsApiKey = pickFirstValue(mergedEnv, keyAliases);
      if (settingsApiKey) {
        apiKey = settingsApiKey;
        claudeSettingsUsed = true;
      }
    }

    const endpointFromEnv = pickFirstValue(mergedEnv, endpointAliases);
    const useEnvEndpoint =
      normalizeEndpoint(apiEndpoint) === normalizeEndpoint(defaultEndpoint);
    if (endpointFromEnv && useEnvEndpoint) {
      apiEndpoint = endpointFromEnv;
      claudeSettingsUsed = true;
    }

    const modelFromEnv = pickFirstValue(mergedEnv, modelAliases);
    if (modelFromEnv) {
      modelId = modelFromEnv;
      claudeSettingsUsed = true;
    }

    if (claudeSettingsUsed) {
      sources.push(claudeSettingsPath);
    }
  }

  // Read from process.env (system environment variables / .env files loaded by Vite)
  const processEnvRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.trim()) {
      processEnvRecord[normalizeAliasKey(key)] = value.trim();
    }
  }

  if (!apiKey) {
    const envKey = pickFirstValue(processEnvRecord, keyAliases);
    if (envKey) {
      apiKey = envKey;
      sources.push("process.env");
    }
  }

  const envEndpoint = pickFirstValue(processEnvRecord, endpointAliases);
  if (
    envEndpoint &&
    normalizeEndpoint(apiEndpoint) === normalizeEndpoint(defaultEndpoint)
  ) {
    apiEndpoint = envEndpoint;
    if (!sources.includes("process.env")) sources.push("process.env");
  }

  const envModel = pickFirstValue(processEnvRecord, modelAliases);
  if (envModel && modelId === defaultModel) {
    modelId = envModel;
    if (!sources.includes("process.env")) sources.push("process.env");
  }

  if (!modelId.trim() && defaultModel) {
    modelId = defaultModel;
  }

  if (!apiEndpoint.trim() && defaultEndpoint) {
    apiEndpoint = defaultEndpoint;
  }

  const endpointMode: "official" | "custom" =
    normalizeEndpoint(apiEndpoint) &&
    normalizeEndpoint(apiEndpoint) !== normalizeEndpoint(defaultEndpoint)
      ? "custom"
      : "official";

  return {
    apiKey,
    modelId,
    apiEndpoint,
    endpointMode,
    source: Array.from(new Set(sources)),
  };
}

export const Route = createFileRoute("/api/local-config")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isServerLocalConfigEnabled()) {
            return Response.json(
              {
                status: "error",
                message:
                  "Local config API is disabled in deployed environments. Please enter your API key manually.",
              },
              { status: 403 }
            );
          }

          const body = await safeReadRequestBody(request);
          if (!body) {
            return Response.json(
              { status: "error", message: "Invalid JSON request body" },
              { status: 400 }
            );
          }

          const provider = (body.provider || "").trim().toLowerCase();

          if (!isProviderId(provider)) {
            return Response.json(
              { status: "error", message: "Unsupported provider" },
              { status: 400 }
            );
          }

          const config = await readLocalConfigByProvider(provider, {
            defaultEndpoint: body.defaultEndpoint,
            defaultModel: body.defaultModel,
          });

          return Response.json({ status: "ok", data: config });
        } catch (error) {
          console.error("Local config read error:", error);
          const detail =
            error instanceof Error ? error.message : String(error ?? "unknown error");
          return Response.json(
            { status: "error", message: "Failed to read local config", detail },
            { status: 500 }
          );
        }
      },
    },
  },
});
