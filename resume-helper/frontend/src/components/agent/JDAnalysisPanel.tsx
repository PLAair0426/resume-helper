"use client";

import { useAgentStore } from "@/store/useAgentStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Target } from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  must_have: {
    label: "必须",
    color:
      "bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]",
  },
  title_level: {
    label: "职级",
    color:
      "bg-[var(--assistant-card)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]",
  },
  core: {
    label: "核心",
    color:
      "bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]",
  },
  evidence: {
    label: "证据",
    color:
      "bg-[var(--assistant-card)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]",
  },
  nice_to_have: {
    label: "加分",
    color:
      "bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]",
  },
};

export function JDAnalysisPanel() {
  const {
    jdText,
    jobTitle,
    jdAnalysis,
    jdLoading,
    lastError,
    setJDText,
    setJobTitle,
    analyzeJD,
  } = useAgentStore();

  return (
    <div className="flex flex-col gap-3 h-full text-[var(--assistant-text-primary)]">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 assistant-accent" />
        <span className="font-medium text-sm assistant-text-primary">JD 关键词分析</span>
      </div>

      <Input
        placeholder="目标岗位名称，例如：数据分析师"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        className="text-sm bg-[var(--assistant-card)] border-[var(--assistant-border)] placeholder:text-[var(--assistant-text-quaternary)]"
      />

      <Textarea
        placeholder="粘贴岗位描述（JD）文本..."
        value={jdText}
        onChange={(e) => setJDText(e.target.value)}
        className="text-sm min-h-[120px] resize-none bg-[var(--assistant-card)] border-[var(--assistant-border)] placeholder:text-[var(--assistant-text-quaternary)]"
      />

      <Button
        size="sm"
        onClick={() => analyzeJD()}
        disabled={jdLoading || !jdText.trim()}
        className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
      >
        {jdLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <Search className="w-4 h-4 mr-1" />
        )}
        {jdLoading ? "分析中..." : "分析关键词"}
      </Button>

      {lastError && (
        <p className="text-xs text-[var(--assistant-danger)]">{lastError}</p>
      )}

      {jdAnalysis && (
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => {
              const items = (jdAnalysis as any)[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="assistant-card rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>
                      {label}
                    </Badge>
                    <span className="text-[10px] assistant-text-tertiary">
                      权重 {items[0]?.weight || ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {items.map((item: any, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs font-normal cursor-default bg-[var(--assistant-card)] text-[var(--assistant-text-secondary)] border-[var(--assistant-border)]"
                      >
                        {item.keyword || item}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
