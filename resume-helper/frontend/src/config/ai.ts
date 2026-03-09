/**
 * AI 服务商配置
 * 所有服务商均兼容 OpenAI Chat Completions 接口格式
 */

export type AIModelType =
  | "deepseek"
  | "doubao"
  | "openai"
  | "codex"
  | "anthropic"
  | "gemini"
  | "qwen"
  | "zhipu"
  | "moonshot"
  | "baichuan"
  | "yi"
  | "minimax"
  | "spark"
  | "stepfun"
  | "siliconflow"
  | "groq"
  | "mistral";

export type EndpointMode = "official" | "custom";

export interface AIProviderCredentials {
  apiKey: string;
  modelId: string;
  apiEndpoint: string;
  endpointMode?: EndpointMode;
}

export interface AIProviderMeta {
  /** 默认 API 端点（不含 /chat/completions） */
  defaultEndpoint: string;
  /** 是否需要用户填写模型 ID */
  requiresModelId: boolean;
  /** 默认模型 ID（requiresModelId 为 false 时使用） */
  defaultModel?: string;
  /** 是否需要用户填写自定义端点 */
  requiresEndpoint: boolean;
  /** 获取 API Key 的链接 */
  link: string;
  /** 图标颜色 class */
  color: string;
  /** 背景色 class */
  bgColor: string;
}

/**
 * 所有支持的 AI 服务商元数据
 */
export const AI_PROVIDERS: Record<AIModelType, AIProviderMeta> = {
  deepseek: {
    defaultEndpoint: "https://api.deepseek.com/v1",
    requiresModelId: false,
    defaultModel: "deepseek-chat",
    requiresEndpoint: false,
    link: "https://platform.deepseek.com",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  doubao: {
    defaultEndpoint: "https://ark.cn-beijing.volces.com/api/v3",
    requiresModelId: true,
    requiresEndpoint: false,
    link: "https://console.volcengine.com/ark",
    color: "text-violet-500",
    bgColor: "bg-violet-50 dark:bg-violet-950/50",
  },
  openai: {
    defaultEndpoint: "https://api.openai.com/v1",
    requiresModelId: true,
    defaultModel: "gpt-4o",
    requiresEndpoint: true,
    link: "https://platform.openai.com/api-keys",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/50",
  },
  codex: {
    defaultEndpoint: "https://api.openai.com/v1",
    requiresModelId: true,
    defaultModel: "codex-mini-latest",
    requiresEndpoint: true,
    link: "https://platform.openai.com/api-keys",
    color: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-900/60",
  },
  anthropic: {
    defaultEndpoint: "https://api.anthropic.com/v1",
    requiresModelId: true,
    defaultModel: "claude-sonnet-4-20250514",
    requiresEndpoint: true,
    link: "https://console.anthropic.com/settings/keys",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
  gemini: {
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresModelId: true,
    defaultModel: "gemini-2.0-flash",
    requiresEndpoint: true,
    link: "https://aistudio.google.com/apikey",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  qwen: {
    defaultEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    requiresModelId: false,
    defaultModel: "qwen-plus",
    requiresEndpoint: false,
    link: "https://dashscope.console.aliyun.com/apiKey",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
  },
  zhipu: {
    defaultEndpoint: "https://open.bigmodel.cn/api/paas/v4",
    requiresModelId: false,
    defaultModel: "glm-4-flash",
    requiresEndpoint: false,
    link: "https://open.bigmodel.cn/usercenter/apikeys",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  moonshot: {
    defaultEndpoint: "https://api.moonshot.cn/v1",
    requiresModelId: false,
    defaultModel: "moonshot-v1-8k",
    requiresEndpoint: false,
    link: "https://platform.moonshot.cn/console/api-keys",
    color: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-50 dark:bg-slate-950/50",
  },
  baichuan: {
    defaultEndpoint: "https://api.baichuan-ai.com/v1",
    requiresModelId: false,
    defaultModel: "Baichuan4",
    requiresEndpoint: false,
    link: "https://platform.baichuan-ai.com/console/apikey",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
  yi: {
    defaultEndpoint: "https://api.lingyiwanwu.com/v1",
    requiresModelId: false,
    defaultModel: "yi-lightning",
    requiresEndpoint: false,
    link: "https://platform.lingyiwanwu.com/apikeys",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  minimax: {
    defaultEndpoint: "https://api.minimax.chat/v1",
    requiresModelId: false,
    defaultModel: "MiniMax-Text-01",
    requiresEndpoint: false,
    link: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    color: "text-sky-500",
    bgColor: "bg-sky-50 dark:bg-sky-950/50",
  },
  spark: {
    defaultEndpoint: "https://spark-api-open.xf-yun.com/v1",
    requiresModelId: false,
    defaultModel: "generalv3.5",
    requiresEndpoint: false,
    link: "https://console.xfyun.cn/services/bm35",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  stepfun: {
    defaultEndpoint: "https://api.stepfun.com/v1",
    requiresModelId: false,
    defaultModel: "step-1-8k",
    requiresEndpoint: false,
    link: "https://platform.stepfun.com/interface-key",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
  },
  siliconflow: {
    defaultEndpoint: "https://api.siliconflow.cn/v1",
    requiresModelId: true,
    requiresEndpoint: false,
    link: "https://cloud.siliconflow.cn/account/ak",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
  groq: {
    defaultEndpoint: "https://api.groq.com/openai/v1",
    requiresModelId: false,
    defaultModel: "llama-3.3-70b-versatile",
    requiresEndpoint: false,
    link: "https://console.groq.com/keys",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
  mistral: {
    defaultEndpoint: "https://api.mistral.ai/v1",
    requiresModelId: false,
    defaultModel: "mistral-small-latest",
    requiresEndpoint: false,
    link: "https://console.mistral.ai/api-keys",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
};

/** 所有可用的服务商 ID 列表 */
export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AIModelType[];

/**
 * 获取指定服务商的 chat completions URL
 */
export function getCompletionsUrl(provider: AIModelType, customEndpoint?: string): string {
  const meta = AI_PROVIDERS[provider];
  const endpoint = customEndpoint || meta.defaultEndpoint;
  return `${endpoint}/chat/completions`;
}

/**
 * 获取实际使用的 API Endpoint（官方 / 自定义）
 */
export function getEffectiveEndpoint(
  provider: AIModelType,
  credentials: Pick<AIProviderCredentials, "apiEndpoint" | "endpointMode">
): string {
  const meta = AI_PROVIDERS[provider];
  if (credentials.endpointMode === "custom" && credentials.apiEndpoint?.trim()) {
    return credentials.apiEndpoint.trim();
  }
  return meta.defaultEndpoint;
}

/**
 * 获取请求头
 */
export function getHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * 获取实际使用的模型 ID
 */
export function getModelId(provider: AIModelType, userModelId?: string): string {
  const meta = AI_PROVIDERS[provider];
  if (userModelId) return userModelId;
  return meta.defaultModel || "";
}

/**
 * 验证服务商配置是否完整
 */
export function isProviderConfigured(
  provider: AIModelType,
  credentials: AIProviderCredentials
): boolean {
  const meta = AI_PROVIDERS[provider];
  if (!credentials.apiKey?.trim()) return false;
  if (meta.requiresModelId && !credentials.modelId?.trim()) return false;

  const endpointMode =
    credentials.endpointMode ||
    (credentials.apiEndpoint?.trim() ? "custom" : "official");
  if (endpointMode === "custom" && !credentials.apiEndpoint?.trim()) return false;

  return true;
}

// ---- 兼容旧接口（grammar / polish 路由使用）----

export interface AIValidationContext {
  [key: string]: string | undefined;
}

export interface AIModelConfig {
  url: (endpoint?: string) => string;
  requiresModelId: boolean;
  defaultModel?: string;
  headers: (apiKey: string) => Record<string, string>;
  validate: (context: AIValidationContext) => boolean;
}

/** 生成旧格式的 AI_MODEL_CONFIGS（兼容 grammar/polish 路由） */
function buildLegacyConfigs(): Record<AIModelType, AIModelConfig> {
  const result = {} as Record<AIModelType, AIModelConfig>;
  for (const [key, meta] of Object.entries(AI_PROVIDERS)) {
    const id = key as AIModelType;
    result[id] = {
      url: (endpoint?: string) => {
        const base = endpoint || meta.defaultEndpoint;
        return `${base}/chat/completions`;
      },
      requiresModelId: meta.requiresModelId,
      defaultModel: meta.defaultModel,
      headers: (apiKey: string) => getHeaders(apiKey),
      validate: () => true,
    };
  }
  return result;
}

export const AI_MODEL_CONFIGS = buildLegacyConfigs();
