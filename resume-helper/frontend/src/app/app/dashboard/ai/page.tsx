import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "@/i18n/compat/client";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  getEffectiveEndpoint,
  isProviderConfigured,
  type AIModelType,
} from "@/config/ai";
import { LOCAL_CONFIG_ENABLED } from "@/config/deployment";
import { cn } from "@/lib/utils";

type ProviderModelMap = Partial<Record<AIModelType, string[]>>;
type ProviderErrorMap = Partial<Record<AIModelType, string>>;

interface LocalConfigPayload {
  apiKey: string;
  modelId: string;
  apiEndpoint: string;
  endpointMode: "official" | "custom";
  source: string[];
}

const AISettingsPage = () => {
  const [hydrated, setHydrated] = useState(false);
  const {
    selectedModel,
    setSelectedModel,
    providers,
    setProviderField,
    getCredentials,
  } = useAIConfigStore();

  const [currentModel, setCurrentModel] = useState<AIModelType>("deepseek");
  const [modelOptionsMap, setModelOptionsMap] = useState<ProviderModelMap>({});
  const [modelFetchErrors, setModelFetchErrors] = useState<ProviderErrorMap>({});
  const [loadingProvider, setLoadingProvider] = useState<AIModelType | null>(null);
  const [localConfigLoading, setLocalConfigLoading] = useState(false);
  const [localConfigLoaded, setLocalConfigLoaded] = useState(false);
  const [localConfigHasApiKey, setLocalConfigHasApiKey] = useState(false);
  const [localConfigError, setLocalConfigError] = useState("");
  const [localConfigSources, setLocalConfigSources] = useState<string[]>([]);
  const [forceManual, setForceManual] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      setCurrentModel(selectedModel);
    }
  }, [hydrated, selectedModel]);

  const t = useTranslations();

  const currentCreds = getCredentials(currentModel);
  const meta = AI_PROVIDERS[currentModel];
  const showLocalConfigPanel =
    LOCAL_CONFIG_ENABLED && AI_PROVIDER_IDS.includes(currentModel);
  const useLocalReadOnlyPanel = showLocalConfigPanel && localConfigHasApiKey && !forceManual;
  const endpointMode = currentCreds.endpointMode === "custom" ? "custom" : "official";
  const effectiveEndpoint = getEffectiveEndpoint(currentModel, currentCreds);
  const isModelLoading = loadingProvider === currentModel;
  const modelFetchError = modelFetchErrors[currentModel] || "";
  const currentProviderModelCount = modelOptionsMap[currentModel]?.length || 0;

  const modelOptions = useMemo(() => {
    const options = [
      currentCreds.modelId,
      ...(modelOptionsMap[currentModel] || []),
      meta.defaultModel || "",
    ]
      .map((id) => id.trim())
      .filter(Boolean);

    return Array.from(new Set(options));
  }, [currentCreds.modelId, currentModel, meta.defaultModel, modelOptionsMap]);

  const maskedApiKey = useMemo(() => {
    const key = currentCreds.apiKey.trim();
    if (!key) return t("dashboard.settings.ai.localConfigValueEmpty");
    if (key.length <= 10) return "*".repeat(key.length);
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }, [currentCreds.apiKey, t]);

  const loadLocalProviderConfig = useCallback(async (forceOverwrite = false) => {
    setLocalConfigLoading(true);
    setLocalConfigError("");

    try {
      const response = await fetch("/api/local-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: currentModel,
          defaultEndpoint: meta.defaultEndpoint,
          defaultModel: meta.defaultModel || "",
        }),
      });

      const json = (await response.json()) as {
        status?: string;
        message?: string;
        data?: LocalConfigPayload;
      };

      if (!response.ok || json.status !== "ok" || !json.data) {
        throw new Error(
          json.message || t("dashboard.settings.ai.localConfigReadFailed")
        );
      }

      const data = json.data;
      const localApiKey = data.apiKey?.trim() || "";
      const existingCreds = getCredentials(currentModel);
      const hasExistingConfig = Boolean(existingCreds.apiKey.trim());

      // Only write to store if:
      // - The provider has no existing config (first-time load), OR
      // - The user explicitly clicked the refresh button (forceOverwrite)
      if (!hasExistingConfig || forceOverwrite) {
        if (localApiKey) {
          setProviderField(currentModel, "apiKey", localApiKey);
        }
        setProviderField(
          currentModel,
          "modelId",
          data.modelId || meta.defaultModel || ""
        );
        setProviderField(currentModel, "apiEndpoint", data.apiEndpoint || "");
        setProviderField(currentModel, "endpointMode", data.endpointMode || "official");
      }

      setLocalConfigSources(data.source || []);
      setLocalConfigHasApiKey(Boolean(localApiKey));

      if (!localApiKey) {
        setLocalConfigError(t("dashboard.settings.ai.localConfigKeyMissing"));
      }
    } catch (error) {
      setLocalConfigHasApiKey(false);
      setLocalConfigError(
        error instanceof Error
          ? error.message
          : t("dashboard.settings.ai.localConfigReadFailed")
      );
    } finally {
      setLocalConfigLoaded(true);
      setLocalConfigLoading(false);
    }
  }, [
    currentModel,
    meta.defaultEndpoint,
    meta.defaultModel,
    setProviderField,
    getCredentials,
    t,
  ]);

  const refreshModelList = useCallback(async () => {
    const apiKey = currentCreds.apiKey.trim();
    if (!apiKey) {
      setModelFetchErrors((prev) => ({
        ...prev,
        [currentModel]: t("dashboard.settings.ai.modelFetchNeedApiKey"),
      }));
      return;
    }

    setLoadingProvider(currentModel);
    setModelFetchErrors((prev) => ({ ...prev, [currentModel]: "" }));

    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          apiEndpoint: effectiveEndpoint,
        }),
      });

      const json = (await response.json()) as {
        status?: string;
        message?: string;
        models?: string[];
      };

      if (!response.ok || json.status !== "ok") {
        throw new Error(
          json.message || t("dashboard.settings.ai.modelFetchFailed")
        );
      }

      const models = (json.models || []).filter((id) => id.trim().length > 0);
      setModelOptionsMap((prev) => ({ ...prev, [currentModel]: models }));

      if (!currentCreds.modelId && models.length > 0) {
        setProviderField(currentModel, "modelId", models[0]);
      }
    } catch (error) {
      setModelFetchErrors((prev) => ({
        ...prev,
        [currentModel]:
          error instanceof Error
            ? error.message
            : t("dashboard.settings.ai.modelFetchFailed"),
      }));
    } finally {
      setLoadingProvider(null);
    }
  }, [
    currentCreds.apiKey,
    currentCreds.modelId,
    currentModel,
    effectiveEndpoint,
    setProviderField,
    t,
  ]);

  useEffect(() => {
    setLocalConfigLoaded(false);
    setLocalConfigHasApiKey(false);
    setLocalConfigSources([]);
    setLocalConfigError("");
    setForceManual(false);
  }, [currentModel]);

  useEffect(() => {
    if (useLocalReadOnlyPanel) return;
    if (!meta.requiresModelId) return;
    if (!currentCreds.apiKey.trim()) return;
    if (currentProviderModelCount > 0) return;
    void refreshModelList();
  }, [
    useLocalReadOnlyPanel,
    currentCreds.apiKey,
    currentProviderModelCount,
    meta.requiresModelId,
    refreshModelList,
  ]);

  useEffect(() => {
    if (!showLocalConfigPanel) return;
    if (localConfigLoaded) return;
    if (localConfigLoading) return;
    void loadLocalProviderConfig();
  }, [
    showLocalConfigPanel,
    loadLocalProviderConfig,
    localConfigLoaded,
    localConfigLoading,
  ]);

  return (
    <div className="mx-auto py-4 px-4">
      <div className="flex gap-8">
        {/* 左侧面板 */}
        <div className="w-64 space-y-6 shrink-0">
          <div>
            <Label className="text-sm mb-2 block text-muted-foreground">
              {t("dashboard.settings.ai.currentModel")}
            </Label>
            <Select value={hydrated ? selectedModel : "deepseek"} onValueChange={(v) => setSelectedModel(v as AIModelType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("dashboard.settings.ai.selectModel")} />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDER_IDS.map((id) => {
                  return (
                    <SelectItem key={id} value={id} className="flex items-center gap-2">
                      <span>{t(`dashboard.settings.ai.${id}.title`)}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

          {/* 服务商列表 */}
          <div className="flex flex-col space-y-1 max-h-[60vh] overflow-y-auto">
            {AI_PROVIDER_IDS.map((id) => {
              const isActive = currentModel === id;
              const creds = providers[id];
              const configured = creds ? isProviderConfigured(id, creds) : false;

              return (
                <button
                  key={id}
                  onClick={() => setCurrentModel(id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-left relative",
                    "transition-all duration-200",
                    "hover:bg-primary/10",
                    isActive && "bg-primary/10"
                  )}
                >
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className={cn("font-medium text-sm truncate", isActive && "text-primary")}>
                      {t(`dashboard.settings.ai.${id}.title`)}
                    </span>
                  </div>
                  {configured && (
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧配置面板 */}
        <div className="flex-1 max-w-2xl">
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">
                {t(`dashboard.settings.ai.${currentModel}.title`)}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t(`dashboard.settings.ai.${currentModel}.description`)}
              </p>
            </div>

            <div className="space-y-6">
              {useLocalReadOnlyPanel ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-base font-medium">
                      {t("dashboard.settings.ai.localConfigTitle")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForceManual(true)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border",
                          "border-gray-200 dark:border-gray-800",
                          "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                        )}
                      >
                        手动输入
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadLocalProviderConfig(true)}
                        disabled={localConfigLoading}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border",
                          "border-gray-200 dark:border-gray-800",
                          "text-muted-foreground hover:text-foreground hover:bg-primary/5",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {localConfigLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {localConfigLoading
                          ? t("dashboard.settings.ai.localConfigLoading")
                          : t("dashboard.settings.ai.localConfigReload")}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.settings.ai.localConfigHint")}
                  </p>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      {t("dashboard.settings.ai.localConfigApiKey")}
                    </Label>
                    <Input
                      readOnly
                      value={maskedApiKey}
                      className={cn(
                        "h-11",
                        "bg-muted/40 dark:bg-muted/20",
                        "border-gray-200 dark:border-gray-800",
                        "text-muted-foreground"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      {t("dashboard.settings.ai.localConfigModel")}
                    </Label>
                    <Input
                      readOnly
                      value={currentCreds.modelId || meta.defaultModel || ""}
                      className={cn(
                        "h-11",
                        "bg-muted/40 dark:bg-muted/20",
                        "border-gray-200 dark:border-gray-800",
                        "text-muted-foreground"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      {t("dashboard.settings.ai.localConfigBaseUrl")}
                    </Label>
                    <Input
                      readOnly
                      value={effectiveEndpoint}
                      className={cn(
                        "h-11",
                        "bg-muted/40 dark:bg-muted/20",
                        "border-gray-200 dark:border-gray-800",
                        "text-muted-foreground"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("dashboard.settings.ai.localConfigSource")}
                    </Label>
                    {localConfigSources.length > 0 ? (
                      localConfigSources.map((sourcePath) => (
                        <p
                          key={sourcePath}
                          className="text-xs text-muted-foreground break-all"
                        >
                          {sourcePath}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.settings.ai.localConfigSourceEmpty")}
                      </p>
                    )}
                  </div>

                  {localConfigError && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {localConfigError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* API Key */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">API Key</Label>
                      <div className="flex items-center gap-2">
                        {localConfigHasApiKey && (
                          <button
                            type="button"
                            onClick={() => setForceManual(false)}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border",
                              "border-gray-200 dark:border-gray-800",
                              "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                            )}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            读取本地配置
                          </button>
                        )}
                        <a
                          href={meta.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {t("dashboard.settings.ai.getApiKey")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <Input
                      value={currentCreds.apiKey}
                      onChange={(e) => setProviderField(currentModel, "apiKey", e.target.value)}
                      type="password"
                      placeholder="sk-..."
                      className={cn(
                        "h-11",
                        "bg-white dark:bg-gray-900",
                        "border-gray-200 dark:border-gray-800",
                        "focus:ring-2 focus:ring-primary/20"
                      )}
                    />
                  </div>

                  {/* Model ID */}
                  {meta.requiresModelId && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-base font-medium">
                          {t("dashboard.settings.ai.modelId")}
                        </Label>
                        <button
                          type="button"
                          onClick={() => void refreshModelList()}
                          disabled={isModelLoading || !currentCreds.apiKey.trim()}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border",
                            "border-gray-200 dark:border-gray-800",
                            "text-muted-foreground hover:text-foreground hover:bg-primary/5",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          {isModelLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {isModelLoading
                            ? t("dashboard.settings.ai.refreshingModels")
                            : t("dashboard.settings.ai.refreshModels")}
                        </button>
                      </div>
                      <Select
                        value={currentCreds.modelId || "__empty__"}
                        onValueChange={(value) =>
                          setProviderField(
                            currentModel,
                            "modelId",
                            value === "__empty__" ? "" : value
                          )
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-11",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-800"
                          )}
                        >
                          <SelectValue
                            placeholder={t(
                              "dashboard.settings.ai.modelSelectPlaceholder"
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">
                            {t("dashboard.settings.ai.modelSelectEmpty")}
                          </SelectItem>
                          {modelOptions.map((modelId) => (
                            <SelectItem key={modelId} value={modelId}>
                              {modelId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={currentCreds.modelId}
                        onChange={(e) => setProviderField(currentModel, "modelId", e.target.value)}
                        placeholder={meta.defaultModel || t("dashboard.settings.ai.modelIdPlaceholder")}
                        className={cn(
                          "h-11",
                          "bg-white dark:bg-gray-900",
                          "border-gray-200 dark:border-gray-800",
                          "focus:ring-2 focus:ring-primary/20"
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.settings.ai.modelFetchHint")}
                      </p>
                      {modelFetchError && (
                        <p className="text-xs text-red-500 dark:text-red-400">
                          {modelFetchError}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <Label className="text-base font-medium">
                      {t("dashboard.settings.ai.baseUrlMode")}
                    </Label>
                    <Select
                      value={endpointMode}
                      onValueChange={(value) => setProviderField(currentModel, "endpointMode", value)}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-11",
                          "bg-white dark:bg-gray-900",
                          "border-gray-200 dark:border-gray-800"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">
                          {t("dashboard.settings.ai.baseUrlOfficial")}
                        </SelectItem>
                        <SelectItem value="custom">
                          {t("dashboard.settings.ai.baseUrlRelay")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-medium">
                      {t("dashboard.settings.ai.baseUrl")}
                    </Label>
                    {endpointMode === "official" ? (
                      <Input
                        value={meta.defaultEndpoint}
                        readOnly
                        className={cn(
                          "h-11",
                          "bg-muted/40 dark:bg-muted/20",
                          "border-gray-200 dark:border-gray-800",
                          "text-muted-foreground"
                        )}
                      />
                    ) : (
                      <Input
                        value={currentCreds.apiEndpoint}
                        onChange={(e) => setProviderField(currentModel, "apiEndpoint", e.target.value)}
                        placeholder={meta.defaultEndpoint}
                        className={cn(
                          "h-11",
                          "bg-white dark:bg-gray-900",
                          "border-gray-200 dark:border-gray-800",
                          "focus:ring-2 focus:ring-primary/20"
                        )}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {endpointMode === "official"
                        ? t("dashboard.settings.ai.officialBaseUrl")
                        : t("dashboard.settings.ai.baseUrlHint")}
                    </p>
                  </div>

                  {/* 默认模型提示 */}
                  {!meta.requiresModelId && meta.defaultModel && (
                    <div className="text-sm text-muted-foreground">
                      {t("dashboard.settings.ai.defaultModelHint")}:{" "}
                      <code className="px-1.5 py-0.5 rounded text-xs border border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200">
                        {meta.defaultModel}
                      </code>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AISettingsPage;
