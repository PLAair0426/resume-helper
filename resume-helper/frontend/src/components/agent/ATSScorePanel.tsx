"use client";

import { useAgentStore } from "@/store/useAgentStore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { ResumeData } from "@/types/resume";

function getScoreColor(score: number) {
  if (score >= 0.8) return "var(--assistant-success)";
  if (score >= 0.6) return "var(--assistant-warning)";
  return "var(--assistant-danger)";
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);
  const color = getScoreColor(score);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--assistant-border)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color }}>
        {Math.round(score * 100)}
      </span>
    </div>
  );
}

interface Props {
  resumeData: ResumeData;
}

export function ATSScorePanel({ resumeData }: Props) {
  const { atsScorecard, atsLoading, lastError, runATSAudit } = useAgentStore();

  const riskStyles = {
    low: "bg-[var(--assistant-success-soft)] text-[var(--assistant-success)] border-[var(--assistant-border)]",
    medium:
      "bg-[var(--assistant-warning-soft)] text-[var(--assistant-warning)] border-[var(--assistant-border)]",
    high: "bg-[var(--assistant-danger-soft)] text-[var(--assistant-danger)] border-[var(--assistant-border)]",
  } as const;

  return (
    <div className="flex flex-col gap-3 h-full text-[var(--assistant-text-primary)]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 assistant-accent" />
        <span className="font-medium text-sm">ATS 兼容性评分</span>
      </div>

      <Button
        size="sm"
        onClick={() => runATSAudit(resumeData)}
        disabled={atsLoading}
        className="w-full bg-[var(--assistant-accent-soft)] text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-card)] border border-[var(--assistant-border)] shadow-none"
      >
        {atsLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <ShieldCheck className="w-4 h-4 mr-1" />
        )}
        {atsLoading ? "审计中..." : "运行 ATS 审计"}
      </Button>

      {lastError && <p className="text-xs text-[var(--assistant-danger)]">{lastError}</p>}

      {atsScorecard && (
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            <div className="assistant-card rounded-lg p-3 flex items-center gap-4">
              <ScoreRing score={atsScorecard.overall_score} />
              <div>
                <p className="text-sm font-medium">总体评分</p>
                <Badge variant="outline" className={riskStyles[atsScorecard.format_risk]}>
                  风险: {atsScorecard.format_risk === "low" ? "低" : atsScorecard.format_risk === "medium" ? "中" : "高"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["structure", "keywords", "formatting", "evidence"] as const).map(
                (dim) => {
                  const d = atsScorecard.dimensions[dim];
                  if (!d) return null;
                  const labels = {
                    structure: "结构",
                    keywords: "关键词",
                    formatting: "格式",
                    evidence: "证据",
                  };
                  return (
                    <div key={dim} className="assistant-card rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs assistant-text-tertiary">{labels[dim]}</span>
                        <span className="text-xs font-medium">{Math.round(d.score * 100)}%</span>
                      </div>
                      <div className="w-full rounded-full h-1.5 bg-[var(--assistant-border)]">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${d.score * 100}%`,
                            backgroundColor: getScoreColor(d.score),
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {Object.entries(atsScorecard.dimensions).map(([key, dim]) => {
              const issues = (dim as any).issues || (dim as any).suggestions || [];
              if (issues.length === 0) return null;
              return (
                <div key={key} className="assistant-card rounded-lg p-3">
                  <p className="text-xs font-medium mb-1 assistant-text-tertiary">
                    {key === "evidence" ? "改进建议" : "问题"}
                  </p>
                  {issues.map((issue: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1">
                      {key === "evidence" ? (
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-[var(--assistant-warning)]" />
                      ) : (
                        <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-[var(--assistant-danger)]" />
                      )}
                      <span className="text-xs assistant-text-secondary">{issue}</span>
                    </div>
                  ))}
                </div>
              );
            })}

            {atsScorecard.rewrite_suggestions?.length > 0 && (
              <div className="assistant-card rounded-lg p-3">
                <p className="text-xs font-medium mb-1.5 assistant-text-tertiary">改写建议</p>
                {atsScorecard.rewrite_suggestions.map((s, i) => (
                  <div key={i} className="rounded-md p-2 mb-2 text-xs space-y-1 border border-[var(--assistant-border)] bg-[var(--assistant-card)]">
                    <div className="line-through text-[var(--assistant-text-quaternary)]">{s.original}</div>
                    <div className="assistant-text-primary">{s.suggested}</div>
                    <div className="assistant-text-tertiary">{s.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
