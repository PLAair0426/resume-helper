/**
 * Agent相关类型定义
 */

// JD关键词分析结果
export interface KeywordItem {
  keyword: string;
  variants?: string[];
  weight: number;
}

export interface JDAnalysis {
  must_have: KeywordItem[];
  title_level: KeywordItem[];
  core: KeywordItem[];
  evidence: KeywordItem[];
  nice_to_have: KeywordItem[];
}

// 关键词覆盖度
export interface CoverageResult {
  overall: number;
  by_category: Record<string, number>;
  matched: Array<{ keyword: string; category: string; weight: number }>;
  gaps: Array<{ keyword: string; category: string; weight: number }>;
}

// ATS评分卡
export interface ATSScorecard {
  overall_score: number;
  format_risk: "low" | "medium" | "high";
  dimensions: {
    structure: { score: number; issues: string[] };
    keywords: { score: number; issues?: string[] };
    formatting: { score: number; issues: string[] };
    evidence: { score: number; suggestions: string[] };
  };
  rewrite_suggestions: RewriteSuggestion[];
}

// 改写建议
export interface RewriteSuggestion {
  original: string;
  suggested: string;
  reason: string;
  section?: string;
  jd_reference?: string;
}

// 优化结果
export interface OptimizeResult {
  optimized_profile: ResumeProfile;
  changes: Array<{
    section: string;
    original: string;
    modified: string;
    reason: string;
  }>;
  new_coverage: number;
}

export interface AutoFillResult {
  optimized_profile: ResumeProfile;
  open_questions: string[];
  polish_summary: string;
}

// 后端resume_profile.json格式
export interface ResumeProfile {
  basics: {
    name: string;
    phone?: string | null;
    email?: string | null;
    degree?: string | null;
    graduation_year?: number | null;
    target_role?: string | null;
    summary?: string | null;
  };
  education: Array<{
    school: string;
    degree_type: string;
    major: string;
    start_date: string;
    end_date: string;
    courses?: string[];
    awards?: string[];
    gpa?: string | null;
  }>;
  work_experience: Array<{
    company: string;
    role: string;
    start_date: string;
    end_date: string;
    is_internship: boolean;
    responsibilities: Array<{
      category: string;
      description: string;
      metrics: string[];
      keywords: string[];
    }>;
  }>;
  research: Array<{
    title: string;
    type?: string;
    start_date: string;
    end_date: string;
    description: string;
    contributions?: string;
    publications?: Array<{
      title: string;
      venue: string;
      status: string;
    }>;
  }>;
  skills: Record<string, string[] | Array<{ language: string; level: string }>>;
  metadata?: {
    extraction_confidence?: number;
    source_format?: string;
    missing_fields?: string[];
    open_questions?: string[];
    unmapped_lines?: string[];
    version?: number;
  };
}

// API响应包装
export interface AgentResponse<T> {
  status: "ok" | "error";
  data?: T;
  message?: string;
}
