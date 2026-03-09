"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAgentStore } from "@/store/useAgentStore";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import {
  AI_PROVIDERS,
  getEffectiveEndpoint,
  getModelId,
  type AIModelType,
} from "@/config/ai";
import { LOCAL_CONFIG_ENABLED } from "@/config/deployment";

interface ParseResult {
  profile: any;
  confidence: number;
  missing_fields: string[];
  open_questions: string[];
}

interface Props {
  onImport: (profile: any) => void;
  templateId?: string | null;
  importButtonText?: string;
}

export function ResumeImportPanel({
  onImport,
  templateId,
  importButtonText = "导入到当前简历",
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string>("");

  const [rawResumeText, setRawResumeText] = useState("");
  const [autoFillSuccess, setAutoFillSuccess] = useState<string>("");

  const { autoFillFromText, autoFillLoading, autoFillResult, lastError } =
    useAgentStore();
  const { selectedModel, getCredentials, setProviderField } = useAIConfigStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setParseResult(null);
      setError("");
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/agent/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.session_id) {
        throw new Error(uploadJson.message || "Upload failed");
      }

      setUploading(false);
      setParsing(true);

      const configProvider: AIModelType =
        selectedModel;
      let creds = getCredentials(configProvider);
      const selectedCreds = getCredentials(selectedModel);
      const hasCodexLeak =
        configProvider !== "codex" && /codex/i.test(creds.modelId || "");

      // 缺少 API Key，或发现非 codex 模型却携带 codex 配置时，兜底读取本地配置。
      if (LOCAL_CONFIG_ENABLED && (!creds.apiKey?.trim() || hasCodexLeak)) {
        const providerMeta = AI_PROVIDERS[configProvider];

        try {
          const localConfigRes = await fetch("/api/local-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: configProvider,
              defaultEndpoint: providerMeta.defaultEndpoint,
              defaultModel: providerMeta.defaultModel || "",
            }),
          });

          const localConfigJson = (await localConfigRes.json()) as {
            status?: string;
            data?: {
              apiKey?: string;
              modelId?: string;
              apiEndpoint?: string;
              endpointMode?: "official" | "custom";
            };
          };

          if (localConfigRes.ok && localConfigJson.status === "ok" && localConfigJson.data) {
            const local = localConfigJson.data;
            setProviderField(configProvider, "apiKey", local.apiKey || "");
            setProviderField(configProvider, "modelId", local.modelId || "");
            setProviderField(configProvider, "apiEndpoint", local.apiEndpoint || "");
            if (local.endpointMode) {
              setProviderField(configProvider, "endpointMode", local.endpointMode);
            }
            creds = getCredentials(configProvider);
          }
        } catch {
          // ignore and fallback to existing credentials
        }
      }

      const apiKey = creds.apiKey?.trim();
      const model = getModelId(selectedModel, selectedCreds.modelId || creds.modelId);
      const endpointSource =
        selectedModel === "codex" && selectedCreds.endpointMode === "custom"
          ? selectedCreds
          : creds;
      const endpointProvider: AIModelType =
        selectedModel === "codex" ? "codex" : configProvider;
      const endpoint = getEffectiveEndpoint(endpointProvider, endpointSource);
      const useCustomEndpoint = endpointSource.endpointMode === "custom";

      if (!apiKey) {
        throw new Error("未读取到可用 API Key，请先在 AI 设置中配置或检查本地配置文件。");
      }

      const backendProvider =
        selectedModel === "deepseek"
          ? "deepseek"
          : selectedModel === "anthropic"
            ? "anthropic"
            : "openai";

      const parseCreds =
        backendProvider === "deepseek"
          ? {
              api_key: apiKey,
              provider: "deepseek",
              model,
              ...(useCustomEndpoint ? { api_endpoint: endpoint } : {}),
            }
          : {
              api_key: apiKey,
              provider: backendProvider,
              model,
              api_endpoint: endpoint,
            };

      const maxAttempts = 5;
      let bestParseJson: any = null;
      let bestConfidence = -1;
      let lastErrorMessage = "";
      let shouldStopRetry = false;

      for (let attempt = 1; attempt <= maxAttempts && !shouldStopRetry; attempt += 1) {
        const parseRes = await fetch("/api/agent/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: uploadJson.session_id,
            ...parseCreds,
          }),
        });
        const parseJson = await parseRes.json();

        if (parseJson.profile) {
          const confidence = Number(parseJson.confidence) || 0;
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestParseJson = parseJson;
          }
          if (confidence >= 1) {
            break;
          }
          continue;
        }

        lastErrorMessage = parseJson.message || parseJson.detail || "Parse failed";
        const authLikeError =
          /invalid api key|unauthorized|authenticationerror|status_code=401/i.test(
            lastErrorMessage
          );
        if (authLikeError) {
          shouldStopRetry = true;
          const providerName = selectedModel.toUpperCase();
          lastErrorMessage = `当前 ${providerName} 的 API Key 无效或未授权，请在“AI 服务商 -> ${providerName}”里更新正确的 Key 后重试。`;
        }
      }

      if (bestParseJson?.profile) {
        setParseResult({
          profile: bestParseJson.profile,
          confidence: bestParseJson.confidence || 0,
          missing_fields: bestParseJson.missing_fields || [],
          open_questions: bestParseJson.open_questions || [],
        });
      } else {
        throw new Error(lastErrorMessage || "Parse failed");
      }
    } catch (e: any) {
      setError(e.message || "Operation failed");
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleAutoFill = async () => {
    if (!rawResumeText.trim()) return;

    setError("");
    setAutoFillSuccess("");

    const result = await autoFillFromText(rawResumeText, templateId || null);
    if (!result?.optimized_profile) return;

    onImport(result.optimized_profile);
    setAutoFillSuccess("AI 自动填写已完成，并已应用到当前模板。");
  };

  const panelError = error || lastError || "";

  return (
    <div className="flex flex-col gap-4 text-[var(--assistant-text-primary)]">
      <div className="assistant-card rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 assistant-accent" />
          <span className="font-medium text-sm">AI 自动填写</span>
        </div>

        <Textarea
          placeholder="将完整简历文本粘贴到这里，AI 将自动润色并映射到当前模板。"
          value={rawResumeText}
          onChange={(e) => setRawResumeText(e.target.value)}
          className="text-sm min-h-[140px] resize-y bg-[var(--assistant-card)] border-[var(--assistant-border)] placeholder:text-[var(--assistant-text-quaternary)]"
        />

        <Button
          onClick={handleAutoFill}
          disabled={autoFillLoading || !rawResumeText.trim()}
          className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
        >
          {autoFillLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <FileText className="w-4 h-4 mr-1" />
          )}
          {autoFillLoading ? "AI 处理中..." : "AI 自动填写并润色"}
        </Button>

        {autoFillSuccess && (
          <div className="text-xs flex items-start gap-1.5 text-[var(--assistant-success)]">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{autoFillSuccess}</p>
          </div>
        )}

        {autoFillResult?.open_questions?.length ? (
          <div>
            <p className="text-xs assistant-text-tertiary mb-1">待补充信息：</p>
            <div className="flex flex-wrap gap-1">
              {autoFillResult.open_questions.map((q, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] text-[var(--assistant-warning)] bg-[var(--assistant-warning-soft)] border-[var(--assistant-border)]"
                >
                  {q}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Separator className="bg-[var(--assistant-border)]" />

      <div className="assistant-card rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 assistant-accent" />
          <span className="font-medium text-sm">从文件导入</span>
        </div>

        <div
          className="border border-dashed border-[var(--assistant-border)] rounded-lg p-6 text-center cursor-pointer bg-[var(--assistant-card)] hover:bg-[var(--assistant-accent-soft)] transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) {
              setFile(f);
              setParseResult(null);
              setError("");
            }
          }}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 assistant-text-tertiary" />
          <p className="text-sm assistant-text-secondary">
            {file ? file.name : "点击或拖拽上传 PDF/DOCX/TXT"}
          </p>
          <p className="text-xs assistant-text-quaternary mt-1">
            支持 PDF、DOCX、DOC、TXT、MD
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {file && !parseResult && (
          <Button
            onClick={handleUploadAndParse}
            disabled={uploading || parsing}
            className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
          >
            {(uploading || parsing) && (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            )}
            {uploading ? "上传中..." : parsing ? "解析中..." : "上传并解析"}
          </Button>
        )}
      </div>

      {panelError && (
        <div className="assistant-card rounded-lg p-3 flex items-start gap-1.5 text-[var(--assistant-danger)]">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs">{panelError}</p>
        </div>
      )}

      {parseResult && (
        <div className="assistant-card rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--assistant-success)]" />
            <span className="text-sm">解析完成</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-[var(--assistant-card)] border-[var(--assistant-border)] text-[var(--assistant-text-tertiary)]"
            >
              置信度 {Math.round(parseResult.confidence * 100)}%
            </Badge>
          </div>

          {parseResult.missing_fields.length > 0 && (
            <div>
              <p className="text-xs assistant-text-tertiary mb-1">缺失字段：</p>
              <div className="flex flex-wrap gap-1">
                {parseResult.missing_fields.map((f, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] text-[var(--assistant-warning)] bg-[var(--assistant-warning-soft)] border-[var(--assistant-border)]"
                  >
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={() => onImport(parseResult.profile)}
            className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
          >
            {importButtonText}
          </Button>
        </div>
      )}
    </div>
  );
}
