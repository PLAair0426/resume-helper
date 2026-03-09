"use client";

import { useEffect } from "react";
import { useAgentStore } from "@/store/useAgentStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  ShieldCheck,
  BarChart3,
  FileText,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ResumeData } from "@/types/resume";

interface Props {
  resumeData: ResumeData;
  onTabChange: (tab: string) => void;
}

const actionBtnClass =
  "h-7 px-2 text-xs text-[var(--assistant-text-secondary)] hover:text-[var(--assistant-text-primary)] hover:bg-[var(--assistant-accent-soft)]";

export function AgentToolbar({ resumeData, onTabChange }: Props) {
  const {
    agentConnected,
    jdAnalysis,
    coverage,
    atsScorecard,
    optimizeLoading,
    checkConnection,
    calculateCoverage,
    runATSAudit,
    optimizeContent,
  } = useAgentStore();

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 assistant-card rounded-lg">
      <div
        className="flex items-center gap-1 cursor-pointer"
        onClick={() => checkConnection()}
        title={agentConnected ? "Agent connected" : "Agent disconnected"}
      >
        {agentConnected ? (
          <Wifi className="w-3.5 h-3.5 text-[var(--assistant-success)]" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-[var(--assistant-danger)]" />
        )}
      </div>

      <div className="w-px h-4 bg-[var(--assistant-border)]" />

      <Button
        variant="ghost"
        size="sm"
        className={actionBtnClass}
        onClick={() => onTabChange("jd")}
        disabled={!agentConnected}
      >
        <Target className="w-3.5 h-3.5 mr-1" />
        JD分析
        {jdAnalysis && (
          <Badge
            variant="outline"
            className="ml-1 text-[9px] px-1 py-0 text-[var(--assistant-text-tertiary)] border-[var(--assistant-border)]"
          >
            OK
          </Badge>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={actionBtnClass}
        onClick={() => {
          if (jdAnalysis && !coverage) {
            calculateCoverage(resumeData);
          }
          onTabChange("coverage");
        }}
        disabled={!agentConnected || !jdAnalysis}
      >
        <BarChart3 className="w-3.5 h-3.5 mr-1" />
        覆盖度
        {coverage && (
          <Badge
            variant="outline"
            className="ml-1 text-[9px] px-1 py-0 text-[var(--assistant-text-tertiary)] border-[var(--assistant-border)]"
          >
            {Math.round(coverage.overall * 100)}%
          </Badge>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={actionBtnClass}
        onClick={() => {
          if (!atsScorecard) {
            runATSAudit(resumeData);
          }
          onTabChange("ats");
        }}
        disabled={!agentConnected}
      >
        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
        ATS
        {atsScorecard && (
          <Badge
            variant="outline"
            className="ml-1 text-[9px] px-1 py-0 text-[var(--assistant-text-tertiary)] border-[var(--assistant-border)]"
          >
            {Math.round(atsScorecard.overall_score * 100)}
          </Badge>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={actionBtnClass}
        onClick={() => optimizeContent(resumeData)}
        disabled={!agentConnected || optimizeLoading || !jdAnalysis}
      >
        {optimizeLoading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 mr-1" />
        )}
        优化
      </Button>
    </div>
  );
}
