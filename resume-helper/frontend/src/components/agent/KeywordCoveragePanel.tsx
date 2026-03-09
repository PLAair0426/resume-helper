"use client";

import { useAgentStore } from "@/store/useAgentStore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, CheckCircle2, XCircle } from "lucide-react";
import type { ResumeData } from "@/types/resume";

interface Props {
  resumeData: ResumeData;
}

function getScoreColor(score: number) {
  if (score >= 0.7) return "var(--assistant-success)";
  if (score >= 0.5) return "var(--assistant-warning)";
  return "var(--assistant-danger)";
}

export function KeywordCoveragePanel({ resumeData }: Props) {
  const {
    jdAnalysis,
    coverage,
    coverageLoading,
    lastError,
    calculateCoverage,
  } = useAgentStore();

  const hasJD = !!jdAnalysis;

  return (
    <div className="flex flex-col gap-3 h-full text-[var(--assistant-text-primary)]">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 assistant-accent" />
        <span className="font-medium text-sm">关键词覆盖度</span>
      </div>

      {!hasJD && (
        <p className="text-xs assistant-text-tertiary">请先在 JD 分析中解析岗位描述</p>
      )}

      {hasJD && (
        <Button
          size="sm"
          onClick={() => calculateCoverage(resumeData)}
          disabled={coverageLoading}
          className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
        >
          {coverageLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <BarChart3 className="w-4 h-4 mr-1" />
          )}
          {coverageLoading ? "计算中..." : "计算覆盖度"}
        </Button>
      )}

      {lastError && <p className="text-xs text-[var(--assistant-danger)]">{lastError}</p>}

      {coverage && (
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            <div className="assistant-card rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">总体覆盖度</span>
                <span className="text-sm font-semibold">
                  {Math.round(coverage.overall * 100)}%
                </span>
              </div>
              <div className="w-full rounded-full h-2.5 bg-[var(--assistant-border)]">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${coverage.overall * 100}%`,
                    backgroundColor: getScoreColor(coverage.overall),
                  }}
                />
              </div>
            </div>

            <div className="assistant-card rounded-lg p-3 space-y-2">
              {Object.entries(coverage.by_category).map(([cat, score]) => {
                const labels: Record<string, string> = {
                  must_have: "必须项",
                  title_level: "职级词",
                  core: "核心技能",
                  evidence: "证据词",
                  nice_to_have: "加分项",
                };
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs assistant-text-tertiary">
                        {labels[cat] || cat}
                      </span>
                      <span className="text-xs assistant-text-secondary">{Math.round(score * 100)}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5 bg-[var(--assistant-border)]">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${score * 100}%`,
                          backgroundColor: getScoreColor(score),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {coverage.matched.length > 0 && (
              <div className="assistant-card rounded-lg p-3">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1 assistant-text-secondary">
                  <CheckCircle2 className="w-3 h-3 text-[var(--assistant-success)]" />
                  已匹配 ({coverage.matched.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {coverage.matched.map((m, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[10px] bg-[var(--assistant-success-soft)] text-[var(--assistant-success)] border-[var(--assistant-border)]"
                    >
                      {m.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {coverage.gaps.length > 0 && (
              <div className="assistant-card rounded-lg p-3">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1 assistant-text-secondary">
                  <XCircle className="w-3 h-3 text-[var(--assistant-danger)]" />
                  缺失 ({coverage.gaps.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {coverage.gaps.map((g, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[10px] bg-[var(--assistant-danger-soft)] text-[var(--assistant-danger)] border-[var(--assistant-border)]"
                    >
                      {g.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
