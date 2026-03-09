"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JDAnalysisPanel } from "./JDAnalysisPanel";
import { ATSScorePanel } from "./ATSScorePanel";
import { KeywordCoveragePanel } from "./KeywordCoveragePanel";
import { ResumeImportPanel } from "./ResumeImportPanel";
import { Target, ShieldCheck, BarChart3, FileUp } from "lucide-react";
import type { ResumeData } from "@/types/resume";

interface Props {
  resumeData: ResumeData;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onImport?: (profile: any) => void;
}

const tabTriggerClass =
  "text-xs px-1 gap-1 text-[var(--assistant-text-secondary)] data-[state=active]:bg-[var(--assistant-accent-soft)] data-[state=active]:text-[var(--assistant-text-primary)]";

export function AgentPanel({
  resumeData,
  activeTab,
  onTabChange,
  onImport,
}: Props) {
  const [tab, setTab] = useState(activeTab || "jd");

  const handleTabChange = (value: string) => {
    setTab(value);
    onTabChange?.(value);
  };

  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      className="h-full flex flex-col assistant-card rounded-xl p-2"
    >
      <TabsList className="grid grid-cols-4 h-8 bg-transparent border border-[var(--assistant-border)] rounded-lg p-0.5">
        <TabsTrigger value="jd" className={tabTriggerClass}>
          <Target className="w-3 h-3" />
          JD
        </TabsTrigger>
        <TabsTrigger value="coverage" className={tabTriggerClass}>
          <BarChart3 className="w-3 h-3" />
          覆盖
        </TabsTrigger>
        <TabsTrigger value="ats" className={tabTriggerClass}>
          <ShieldCheck className="w-3 h-3" />
          ATS
        </TabsTrigger>
        <TabsTrigger value="import" className={tabTriggerClass}>
          <FileUp className="w-3 h-3" />
          导入
        </TabsTrigger>
      </TabsList>

      <TabsContent value="jd" className="flex-1 mt-2 overflow-hidden">
        <JDAnalysisPanel />
      </TabsContent>

      <TabsContent value="coverage" className="flex-1 mt-2 overflow-hidden">
        <KeywordCoveragePanel resumeData={resumeData} />
      </TabsContent>

      <TabsContent value="ats" className="flex-1 mt-2 overflow-hidden">
        <ATSScorePanel resumeData={resumeData} />
      </TabsContent>

      <TabsContent value="import" className="flex-1 mt-2 overflow-hidden">
        <ResumeImportPanel
          onImport={onImport || (() => {})}
          templateId={resumeData.templateId}
        />
      </TabsContent>
    </Tabs>
  );
}
