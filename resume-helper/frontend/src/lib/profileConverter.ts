/**
 * 数据模型转换工具
 * ResumeData (Resume Assistant) <-> ResumeProfile (Agent Backend)
 */

import type {
  ResumeData,
  Education,
  Experience,
  Project,
  CustomItem,
} from "@/types/resume";
import type { ResumeProfile } from "@/types/agent";

const IMPORT_EXTRA_SECTION_ID = "custom-imported-extra";
const AI_SECTION_PREFIX = "custom-ai-";

type RoutedUnmapped = {
  skills: string[];
  experience: string[];
  education: string[];
  projects: string[];
  custom: Record<string, { title: string; lines: string[] }>;
};

const MODULE_PATTERNS = {
  skills: [
    /技能|skill|熟悉|掌握|精通|擅长|技术栈|framework|language|python|java|javascript|typescript|react|vue|sql|docker|k8s/i,
  ],
  experience: [
    /工作|任职|就职|公司|岗位|职责|负责|实习|employment|experience|intern|role|manager|engineer/i,
  ],
  education: [
    /教育|毕业|学校|学院|大学|专业|学历|本科|硕士|博士|gpa|course|university|college|bachelor|master|phd/i,
  ],
  projects: [
    /项目|系统|平台|课题|作品|上线|发布|project|platform|product|repo|repository/i,
  ],
} as const;

const AI_CATEGORY_RULES = [
  {
    key: "award",
    zh: "奖项",
    en: "Awards",
    patterns: [/奖项|荣誉|获奖|scholarship|award|honor/i],
  },
  {
    key: "certificate",
    zh: "证书",
    en: "Certificates",
    patterns: [/证书|认证|资格证|certification|certificate|license/i],
  },
  {
    key: "competition",
    zh: "竞赛",
    en: "Competitions",
    patterns: [/竞赛|比赛|大赛|contest|competition|hackathon/i],
  },
  {
    key: "campus",
    zh: "校园",
    en: "Campus",
    patterns: [/校园|学生会|社团|班长|团委|club|campus|student/i],
  },
  {
    key: "volunteer",
    zh: "志愿",
    en: "Volunteer",
    patterns: [/志愿|公益|义工|volunteer|community service/i],
  },
  {
    key: "other",
    zh: "其他",
    en: "Other",
    patterns: [/.*/],
  },
] as const;

type ResumeEducationItem = ResumeData["education"][number];
type ResumeExperienceItem = ResumeData["experience"][number];
type ResumeProjectItem = ResumeData["projects"][number];

type ParsedDateValue =
  | { type: "date"; year: string; month?: string }
  | { type: "present" };

type ExtractedDateInfo = {
  start: ParsedDateValue | null;
  end: ParsedDateValue | null;
  matched: string;
};

const PRESENT_VALUE_PATTERN = /^(至今|现在|目前|present|current|now)$/i;
const RANGE_SEPARATOR_ONLY_PATTERN = /^\s*(?:-|~|to)\s*$/i;
const DATE_TOKEN_SOURCE =
  "(?:19|20)\\d{2}\\s*(?:年\\s*\\d{1,2}\\s*月?|[./-]\\s*\\d{1,2})|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2}\\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?|(?:19|20)\\d{2}|至今|现在|目前|present|current|now";

const EN_MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const WORK_DETAIL_PATTERN =
  /负责|主导|参与|开发|设计|实现|优化|搭建|推进|维护|管理|协作|支持|落地|提升|完成|带领|改进|撰写|led|built|developed|implemented|optimized|improved|managed|collaborated|delivered|reduced|increased/i;
const WORK_METRIC_PATTERN =
  /\d+(?:\.\d+)?\s*(?:%|倍|万|千|k|m|w|人|小时|天|周|月|年|ms|s)\b/i;
const EXPERIENCE_HEADER_PATTERN =
  /公司|集团|有限公司|科技|银行|研究院|任职|就职|岗位|职位|工作经历|工作经验|inc\.?|ltd\.?|corp\.?|llc|engineer|developer|manager|analyst|intern/i;
const EXPERIENCE_STRONG_PATTERN =
  /公司|集团|有限公司|研究院|任职|就职|实习|工作经历|工作经验|employment|work experience|internship/i;
const EXPERIENCE_ROLE_PATTERN =
  /工程师|开发|经理|总监|主管|产品|设计|运营|分析|实习|engineer|developer|manager|analyst|intern/i;
const EDUCATION_HEADER_PATTERN =
  /教育|毕业|学校|学院|大学|专业|学历|本科|硕士|博士|university|college|school|bachelor|master|phd|major/i;
const PROJECT_HEADER_PATTERN =
  /项目|系统|平台|课题|作品|上线|发布|project|platform|product|repo|repository/i;

const RESEARCH_HEADER_PATTERN =
  /科研|论文|期刊|研究|ssci|sci|ei|research|paper|journal/i;
const RESEARCH_DETAIL_PATTERN =
  /调研|问卷|样本|建模|统计|论文|期刊|ssci|sci|ei|研究|research|survey|sample|modeling|statistical/i;
const SECTION_TITLE_ONLY_PATTERN =
  /^(基本信息|个人信息|专业技能|工作经验|工作经历|教育经历|科研经历|项目经历|work experience|experience|education|research|projects?)$/i;

const SAFE_WORK_DETAIL_PATTERN =
  /负责|主导|参与|开发|设计|实现|优化|搭建|推进|维护|管理|协作|支持|落地|提升|完成|带领|改进|撰写|led|built|developed|implemented|optimized|improved|managed|collaborated|delivered|reduced|increased/i;
const SAFE_WORK_METRIC_PATTERN =
  /\d+(?:\.\d+)?\s*(?:%|倍|万|千|k|m|w|小时|天|周|月|年|ms|s)\b/i;
const SAFE_EXPERIENCE_HEADER_PATTERN =
  /公司|集团|有限公司|科技|银行|研究院|任职|就职|岗位|职位|工作经历|工作经验|inc\.?|ltd\.?|corp\.?|llc|engineer|developer|manager|analyst|intern/i;
const SAFE_EXPERIENCE_STRONG_PATTERN =
  /公司|集团|有限公司|研究院|任职|就职|实习|工作经历|工作经验|employment|work experience|internship/i;
const SAFE_EXPERIENCE_ROLE_PATTERN =
  /工程师|开发|经理|总监|主管|产品|设计|运营|分析|实习|engineer|developer|manager|analyst|intern/i;
const SAFE_EDUCATION_HEADER_PATTERN =
  /教育|毕业|学校|学院|大学|专业|学历|本科|硕士|博士|university|college|school|bachelor|master|phd|major/i;
const SAFE_PROJECT_HEADER_PATTERN =
  /项目|系统|平台|课题|作品|上线|发布|project|platform|product|repo|repository/i;
const SAFE_RESEARCH_HEADER_PATTERN =
  /科研|论文|期刊|研究|ssci|sci|ei|research|paper|journal/i;
const SAFE_RESEARCH_DETAIL_PATTERN =
  /调研|问卷|样本|建模|统计|论文|期刊|ssci|sci|ei|研究|research|survey|sample|modeling|statistical/i;
const SAFE_SECTION_TITLE_ONLY_PATTERN =
  /^(基本信息|个人信息|专业技能|工作经验|工作经历|教育经历|科研经历|项目经历|work experience|experience|education|research|projects?)$/i;

function isProjectDominantLine(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  if (!PROJECT_HEADER_PATTERN.test(line) && !SAFE_PROJECT_HEADER_PATTERN.test(line)) {
    return false;
  }
  return !EXPERIENCE_STRONG_PATTERN.test(line) && !SAFE_EXPERIENCE_STRONG_PATTERN.test(line);
}

function normalizeMonth(month: string): string | null {
  const numeric = Number(month);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 12) return null;
  return String(numeric).padStart(2, "0");
}

function parseDateToken(value: string): ParsedDateValue | null {
  const raw = value.trim();
  if (!raw) return null;

  if (PRESENT_VALUE_PATTERN.test(raw)) {
    return { type: "present" };
  }

  const lower = raw.toLowerCase();
  const monthFirstMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*,?\s*((?:19|20)\d{2})\b/i
  );
  if (monthFirstMatch) {
    const month = EN_MONTH_MAP[monthFirstMatch[1].toLowerCase()];
    if (month) {
      return { type: "date", year: monthFirstMatch[2], month };
    }
  }

  const yearFirstMatch = lower.match(
    /\b((?:19|20)\d{2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\b/i
  );
  if (yearFirstMatch) {
    const month = EN_MONTH_MAP[yearFirstMatch[2].toLowerCase()];
    if (month) {
      return { type: "date", year: yearFirstMatch[1], month };
    }
  }

  const yearMonthMatch = raw.match(
    /((?:19|20)\d{2})\s*(?:[./-])\s*(\d{1,2})/
  );
  if (yearMonthMatch) {
    const month = normalizeMonth(yearMonthMatch[2]);
    if (month) {
      return { type: "date", year: yearMonthMatch[1], month };
    }
  }

  const yearOnlyMatch = raw.match(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/);
  if (yearOnlyMatch) {
    return { type: "date", year: yearOnlyMatch[1] };
  }

  return null;
}

function formatDateForRange(
  value: ParsedDateValue | null,
  isEnglish: boolean
): string {
  if (!value) return "";
  if (value.type === "present") {
    return isEnglish ? "Present" : "至今";
  }
  if (value.month) return `${value.year}/${value.month}`;
  return value.year;
}

function formatDateForSingleField(value: ParsedDateValue | null): string {
  if (!value || value.type === "present") return "";
  if (value.month) return `${value.year}/${value.month}`;
  return value.year;
}

function formatDateForBackend(value: ParsedDateValue | null): string {
  if (!value) return "";
  if (value.type === "present") return "至今";
  if (value.month) return `${value.year}/${value.month}`;
  return value.year;
}

function collectDateTokenMatches(
  text: string
): Array<{ text: string; index: number; end: number }> {
  const regex = new RegExp(DATE_TOKEN_SOURCE, "ig");
  const matches: Array<{ text: string; index: number; end: number }> = [];
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined) continue;
    matches.push({
      text: match[0],
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

function extractDateInfoFromText(text: string): ExtractedDateInfo | null {
  const matches = collectDateTokenMatches(text);
  if (!matches.length) return null;

  for (let i = 0; i < matches.length - 1; i += 1) {
    const left = matches[i];
    const right = matches[i + 1];
    const between = text.slice(left.end, right.index);
    if (!RANGE_SEPARATOR_ONLY_PATTERN.test(between)) continue;

    const start = parseDateToken(left.text);
    const end = parseDateToken(right.text);
    if (!start || !end) continue;

    return {
      start,
      end,
      matched: text.slice(left.index, right.end),
    };
  }

  if (matches.length >= 2 && /(?:-|~|\bto\b)/i.test(text)) {
    const start = parseDateToken(matches[0].text);
    const end = parseDateToken(matches[1].text);
    if (start && end) {
      return {
        start,
        end,
        matched: text.slice(matches[0].index, matches[1].end),
      };
    }
  }

  if (matches.length === 1) {
    const start = parseDateToken(matches[0].text);
    if (!start) return null;
    const residue = `${text.slice(0, matches[0].index)}${text.slice(matches[0].end)}`;
    const compactResidue = residue.replace(/[\s|/,:;\-~—–]+/g, "");
    if (compactResidue.length <= 6) {
      return {
        start,
        end: null,
        matched: matches[0].text,
      };
    }
  }

  return null;
}

function formatDateRangeDisplay(
  dateInfo: ExtractedDateInfo,
  isEnglish: boolean
): string {
  const start = formatDateForRange(dateInfo.start, isEnglish);
  const end = formatDateForRange(dateInfo.end, isEnglish);
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - `;
  if (end) return end;
  return "";
}

function normalizeDateRangeFromFields(
  start: string,
  end: string,
  isEnglish: boolean
): string {
  const parsedStart = parseDateToken(start);
  const parsedEnd = parseDateToken(end);
  const startText = formatDateForRange(parsedStart, isEnglish);
  const endText = formatDateForRange(parsedEnd, isEnglish);

  if (startText && endText) return `${startText} - ${endText}`;
  if (startText) return `${startText} - `;
  if (endText) return endText;
  return "";
}

function splitLineByDate(
  line: string
): { content: string; dateInfo: ExtractedDateInfo | null } {
  const dateInfo = extractDateInfoFromText(line);
  if (!dateInfo) {
    return { content: line.trim(), dateInfo: null };
  }

  const content = line
    .replace(dateInfo.matched, " ")
    .replace(/^[\s|/,:;\-~—–]+/, "")
    .replace(/[\s|/,:;\-~—–]+$/, "")
    .trim();

  return { content, dateInfo };
}

function hasExperienceDate(dateValue: string): boolean {
  const [start, end] = parseDateRange(dateValue);
  return Boolean(start || end);
}

function isLikelyWorkDetailLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (/^[\-鈥⒙?]\s*/.test(text)) return true;
  if (WORK_DETAIL_PATTERN.test(text) || SAFE_WORK_DETAIL_PATTERN.test(text)) return true;
  if ((WORK_METRIC_PATTERN.test(text) || SAFE_WORK_METRIC_PATTERN.test(text)) && text.length >= 8) {
    return true;
  }
  return text.length >= 24 && /[。；;.!?]/.test(text);
}

function isLikelyExperienceHeaderLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (isProjectDominantLine(text)) return false;
  if (EXPERIENCE_STRONG_PATTERN.test(text) || SAFE_EXPERIENCE_STRONG_PATTERN.test(text)) {
    return true;
  }
  if (
    (EXPERIENCE_HEADER_PATTERN.test(text) || SAFE_EXPERIENCE_HEADER_PATTERN.test(text)) &&
    (EXPERIENCE_ROLE_PATTERN.test(text) || SAFE_EXPERIENCE_ROLE_PATTERN.test(text))
  ) {
    return true;
  }
  if (isLikelyWorkDetailLine(text)) return false;
  if (text.length > 80) return false;

  const parts = text
    .split(/\s*[|,\\/:\-–—]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    parts.length >= 2 &&
    (EXPERIENCE_ROLE_PATTERN.test(text) || SAFE_EXPERIENCE_ROLE_PATTERN.test(text))
  );
}

function findBestExperienceIndex(
  experience: ResumeExperienceItem[],
  text: string
): number {
  const needle = normalizeCompareText(text);
  if (!needle) return -1;

  let bestScore = 0;
  let bestIndex = -1;

  experience.forEach((item, index) => {
    const company = normalizeCompareText(item.company || "");
    const position = normalizeCompareText(item.position || "");
    let score = 0;
    let matched = false;
    if (company && needle.includes(company)) {
      score += 3;
      matched = true;
    }
    if (position && needle.includes(position)) {
      score += 2;
      matched = true;
    }
    if (matched && !hasExperienceDate(item.date)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
}

function parseExperienceHeaderFields(
  raw: string,
  isEnglish: boolean
): { company: string; position: string } {
  const fallback = {
    company: isEnglish ? "AI Supplement Experience" : "AI补充经历",
    position: isEnglish ? "To Confirm" : "待确认",
  };

  const text = raw
    .replace(/^(work experience|experience|employment)\s*[:：]?\s*/i, "")
    .trim();
  if (!text) return fallback;

  const enMatch = text.match(/^(.+?)\s+(?:as|for)\s+(.+)$/i);
  if (enMatch) {
    return {
      company: enMatch[1].trim() || fallback.company,
      position: enMatch[2].trim() || fallback.position,
    };
  }

  const parts = text
    .split(/\s*[|,\\/:\-–—]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      company: parts[0],
      position: parts.slice(1).join(" / ") || fallback.position,
    };
  }

  return {
    company: text,
    position: fallback.position,
  };
}

function isPlaceholderCompany(value: string): boolean {
  const text = value.trim();
  const lower = text.toLowerCase();
  return lower === "ai supplement experience" || text === "AI补充经历";
}

function isPlaceholderPosition(value: string): boolean {
  const text = value.trim();
  const lower = text.toLowerCase();
  return lower === "to confirm" || lower === "pending" || text === "待确认";
}

function upsertExperienceFromHint(
  experience: ResumeExperienceItem[],
  content: string,
  dateInfo: ExtractedDateInfo | null,
  isEnglish: boolean
): number {
  const cleanContent = content.trim();
  if (cleanContent && isProjectDominantLine(cleanContent)) {
    return -1;
  }

  let targetIndex = cleanContent
    ? findBestExperienceIndex(experience, cleanContent)
    : -1;

  if (targetIndex < 0 && dateInfo) {
    targetIndex = experience.findIndex((item) => !hasExperienceDate(item.date));
  }

  if (targetIndex < 0) {
    if (!cleanContent && !dateInfo) return -1;
    const parsed = parseExperienceHeaderFields(cleanContent, isEnglish);
    experience.push({
      id: `exp_ai_${experience.length}`,
      company: parsed.company,
      position: parsed.position,
      date: dateInfo ? formatDateRangeDisplay(dateInfo, isEnglish) : "",
      details: "",
      visible: true,
    });
    return experience.length - 1;
  }

  const target = experience[targetIndex];
  if (cleanContent) {
    const parsed = parseExperienceHeaderFields(cleanContent, isEnglish);
    if (!target.company?.trim() || isPlaceholderCompany(target.company)) {
      target.company = parsed.company;
    }
    if (!target.position?.trim() || isPlaceholderPosition(target.position)) {
      target.position = parsed.position;
    }
  }

  if (dateInfo && !hasExperienceDate(target.date)) {
    const display = formatDateRangeDisplay(dateInfo, isEnglish);
    if (display) {
      target.date = display;
    }
  }

  return targetIndex;
}

function createSupplementExperience(
  experience: ResumeExperienceItem[],
  isEnglish: boolean,
  dateInfo: ExtractedDateInfo | null = null
): number {
  const date = dateInfo ? formatDateRangeDisplay(dateInfo, isEnglish) : "";
  experience.push({
    id: `exp_ai_${experience.length}`,
    company: isEnglish ? "AI Supplement Experience" : "AI补充经历",
    position: isEnglish ? "To Confirm" : "待确认",
    date,
    details: "",
    visible: true,
  });
  return experience.length - 1;
}

function appendExperienceDetails(
  experience: ResumeExperienceItem[],
  index: number,
  lines: string[]
): void {
  if (index < 0 || index >= experience.length) return;
  const clean = normalizeTextList(lines);
  if (!clean.length) return;

  const existing = stripHtml(experience[index].details || "");
  const deduped = filterKnownLines(clean, existing);
  if (!deduped.length) return;

  experience[index].details = mergeHtmlBullets(
    experience[index].details || "",
    deduped
  );
}

function getExperienceDetailLines(item: ResumeExperienceItem): string[] {
  return normalizeTextList(
    htmlToResponsibilities(item.details || "")
      .map((resp) => (resp?.description || "").trim())
      .filter(Boolean)
  );
}

function setExperienceDetailLines(
  item: ResumeExperienceItem,
  lines: string[]
): void {
  const clean = normalizeTextList(lines);
  item.details = clean.length ? toBulletHtml(clean) : "";
}

function rebalanceExperienceDetails(experience: ResumeExperienceItem[]): void {
  if (experience.length < 2) return;

  const linesByIndex = experience.map((item) => getExperienceDetailLines(item));
  const counts = linesByIndex.map((lines) => lines.length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...counts, 0);
  const maxIndex = counts.indexOf(maxCount);
  const emptyCount = counts.filter((count) => count === 0).length;
  const avg = counts.length ? total / counts.length : 0;
  const imbalanced = emptyCount >= 1 && maxCount >= Math.max(8, Math.ceil(avg * 2));
  if (!imbalanced || maxIndex < 0) return;

  const ownership = new Map<string, number[]>();
  linesByIndex.forEach((lines, idx) => {
    for (const line of lines) {
      const key = normalizeCompareText(line);
      if (!key || key.length < 8) continue;
      const owners = ownership.get(key) || [];
      owners.push(idx);
      ownership.set(key, owners);
    }
  });

  const removeKeys = new Set<string>();
  for (const [key, owners] of ownership.entries()) {
    if (owners.length <= 1) continue;
    if (!owners.includes(maxIndex)) continue;
    if (!owners.some((idx) => idx !== maxIndex)) continue;
    removeKeys.add(key);
  }

  if (!removeKeys.size) return;

  const retained = linesByIndex[maxIndex].filter(
    (line) => !removeKeys.has(normalizeCompareText(line))
  );
  setExperienceDetailLines(experience[maxIndex], retained);
}

function mergeDuplicateExperienceItems(
  experience: ResumeExperienceItem[]
): ResumeExperienceItem[] {
  const merged: ResumeExperienceItem[] = [];
  const indexByStrongKey = new Map<string, number>();
  const indexByLooseKey = new Map<string, number>();

  for (const item of experience) {
    const companyKey = normalizeCompareText(item.company || "");
    const positionKey = normalizeCompareText(item.position || "");
    const dateKey = normalizeCompareText(item.date || "");
    const strongKey = `${companyKey}|${positionKey}|${dateKey}`;
    const looseKey = `${companyKey}|${positionKey}`;

    let targetIndex = -1;
    if (companyKey) {
      if (indexByStrongKey.has(strongKey)) {
        targetIndex = indexByStrongKey.get(strongKey)!;
      } else if (!dateKey && indexByLooseKey.has(looseKey)) {
        targetIndex = indexByLooseKey.get(looseKey)!;
      } else if (dateKey && indexByLooseKey.has(looseKey)) {
        const looseIndex = indexByLooseKey.get(looseKey)!;
        const looseDateKey = normalizeCompareText(merged[looseIndex]?.date || "");
        if (!looseDateKey) {
          targetIndex = looseIndex;
        }
      }
    }

    if (targetIndex < 0) {
      const next = { ...item };
      merged.push(next);
      const idx = merged.length - 1;
      if (companyKey) {
        indexByStrongKey.set(strongKey, idx);
        indexByLooseKey.set(looseKey, idx);
      }
      continue;
    }

    const target = merged[targetIndex];
    if ((!target.position?.trim() || isPlaceholderPosition(target.position)) && item.position?.trim()) {
      target.position = item.position;
    }
    if (!target.date?.trim() && item.date?.trim()) {
      target.date = item.date;
    }

    const extraLines = filterKnownLines(
      getExperienceDetailLines(item),
      stripHtml(target.details || "")
    );
    if (extraLines.length) {
      target.details = mergeHtmlBullets(target.details || "", extraLines);
    }
  }

  return merged;
}

function pruneEmptySupplementExperiences(
  experience: ResumeExperienceItem[]
): ResumeExperienceItem[] {
  return experience.filter((item) => {
    const company = item.company || "";
    const position = item.position || "";
    const hasDetails = Boolean(stripHtml(item.details || "").trim());
    const hasDate = Boolean((item.date || "").trim());
    const isEmptySupplement =
      isPlaceholderCompany(company) &&
      isPlaceholderPosition(position) &&
      !hasDate &&
      !hasDetails;
    return !isEmptySupplement;
  });
}

function isPlaceholderProjectName(value: string): boolean {
  const text = value.trim();
  const lower = text.toLowerCase();
  const compact = normalizeCompareText(text);
  return (
    lower === "ai supplement project" ||
    text === "AI补充项目" ||
    lower === "to confirm project" ||
    text === "待确认项目" ||
    /(?:ai\s*补充项目|ai\s*supplement\s*project|to\s*confirm\s*project|待确认项目)/i.test(
      text
    ) ||
    compact === "aisupplementproject" ||
    compact === "aibuchongxiangmu" ||
    compact === "toconfirmproject" ||
    compact === "待确认项目"
  );
}

function isPlaceholderProjectRole(value: string): boolean {
  const text = value.trim();
  const lower = text.toLowerCase();
  return (
    lower === "to confirm" ||
    lower === "pending" ||
    text === "待确认" ||
    /(?:待确认|to\s*confirm|pending)/i.test(text)
  );
}

function isLikelyOrganizationText(text: string): boolean {
  return /公司|集团|有限公司|研究院|学院|大学|银行|科技|中心|实验室|inc\.?|ltd\.?|corp\.?|llc/i.test(
    text
  );
}

function isLikelyProjectHeaderLine(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  if (
    PROJECT_HEADER_PATTERN.test(line) ||
    SAFE_PROJECT_HEADER_PATTERN.test(line) ||
    RESEARCH_HEADER_PATTERN.test(line) ||
    SAFE_RESEARCH_HEADER_PATTERN.test(line)
  ) {
    return true;
  }
  if (isLikelyOrganizationText(line)) return false;
  const zhCount = (line.match(/[\u4e00-\u9fff]/g) || []).length;
  return (
    zhCount >= 8 &&
    /研究|课题|项目|系统|平台|模型|分析|机制|协同|算法|框架|设计|开发|优化/i.test(
      line
    )
  );
}

function isLikelyProjectDetailLine(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  if (/^[\-•·●]\s*/.test(line)) return true;
  if (
    RESEARCH_DETAIL_PATTERN.test(line) ||
    SAFE_RESEARCH_DETAIL_PATTERN.test(line)
  ) {
    return true;
  }
  if (
    isLikelyWorkDetailLine(line) &&
    !EXPERIENCE_STRONG_PATTERN.test(line) &&
    !SAFE_EXPERIENCE_STRONG_PATTERN.test(line)
  ) {
    return true;
  }
  return line.length >= 24 && /[。；;.!?]/.test(line);
}

function parseProjectHeaderFields(
  raw: string,
  isEnglish: boolean
): { name: string; role: string } {
  const fallback = {
    name: isEnglish ? "AI Supplement Project" : "AI补充项目",
    role: isEnglish ? "To Confirm" : "待确认",
  };
  const text = raw
    .replace(
      /^(project|projects|research|项目|项目经历|科研|研究|课题)\s*[:：]?\s*/i,
      ""
    )
    .trim();
  if (!text) return fallback;
  const parts = text
    .split(/\s*[|,\\/:\-–—]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      name: parts[0] || fallback.name,
      role: parts.slice(1).join(" / ") || fallback.role,
    };
  }
  return { name: text, role: fallback.role };
}

function findBestProjectIndex(projects: ResumeProjectItem[], text: string): number {
  const needle = normalizeCompareText(text);
  if (!needle) return -1;

  let bestScore = 0;
  let bestIndex = -1;

  projects.forEach((item, index) => {
    const name = normalizeCompareText(item.name || "");
    const role = normalizeCompareText(item.role || "");
    let score = 0;
    if (name && needle.includes(name)) score += 3;
    if (role && needle.includes(role)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
}

function getProjectDetailLines(item: ResumeProjectItem): string[] {
  return normalizeTextList(
    htmlToResponsibilities(item.description || "")
      .map((resp) => (resp?.description || "").trim())
      .filter(Boolean)
  );
}

function setProjectDetailLines(item: ResumeProjectItem, lines: string[]): void {
  const clean = normalizeTextList(lines);
  item.description = clean.length ? toBulletHtml(clean) : "";
}

function appendProjectDetails(
  projects: ResumeProjectItem[],
  index: number,
  lines: string[]
): void {
  if (index < 0 || index >= projects.length) return;
  const clean = normalizeTextList(lines);
  if (!clean.length) return;

  const existing = stripHtml(projects[index].description || "");
  const deduped = filterKnownLines(clean, existing);
  if (!deduped.length) return;

  projects[index].description = mergeHtmlBullets(
    projects[index].description || "",
    deduped
  );
}

function upsertProjectFromHint(
  projects: ResumeProjectItem[],
  content: string,
  dateInfo: ExtractedDateInfo | null,
  isEnglish: boolean
): number {
  const cleanContent = content.trim();
  let targetIndex = cleanContent ? findBestProjectIndex(projects, cleanContent) : -1;

  if (targetIndex < 0 && dateInfo) {
    targetIndex = projects.findIndex((item) => !hasExperienceDate(item.date));
  }

  if (targetIndex < 0) {
    if (!cleanContent && !dateInfo) return -1;
    const parsed = parseProjectHeaderFields(cleanContent, isEnglish);
    projects.push({
      id: `proj_ai_${projects.length}`,
      name: parsed.name,
      role: parsed.role,
      date: dateInfo ? formatDateRangeDisplay(dateInfo, isEnglish) : "",
      description: "",
      visible: true,
    });
    return projects.length - 1;
  }

  const target = projects[targetIndex];
  if (cleanContent) {
    const parsed = parseProjectHeaderFields(cleanContent, isEnglish);
    if (!target.name?.trim() || isPlaceholderProjectName(target.name)) {
      target.name = parsed.name;
    }
    if (!target.role?.trim() || isPlaceholderProjectRole(target.role)) {
      target.role = parsed.role;
    }
  }

  if (dateInfo && !hasExperienceDate(target.date)) {
    const display = formatDateRangeDisplay(dateInfo, isEnglish);
    if (display) {
      target.date = display;
    }
  }

  return targetIndex;
}

function pruneEmptySupplementProjects(
  projects: ResumeProjectItem[]
): ResumeProjectItem[] {
  return projects.filter((item) => {
    const hasDescription = Boolean(stripHtml(item.description || "").trim());
    const hasDate = Boolean((item.date || "").trim());
    const isEmptySupplement =
      isPlaceholderProjectName(item.name || "") &&
      isPlaceholderProjectRole(item.role || "") &&
      !hasDate &&
      !hasDescription;
    return !isEmptySupplement;
  });
}

function mergeDuplicateProjects(projects: ResumeProjectItem[]): ResumeProjectItem[] {
  const merged: ResumeProjectItem[] = [];
  const indexByStrongKey = new Map<string, number>();
  const indexByLooseKey = new Map<string, number>();

  for (const item of projects) {
    const nameKey = normalizeCompareText(item.name || "");
    const dateKey = normalizeCompareText(item.date || "");
    const strongKey = `${nameKey}|${dateKey}`;
    const looseKey = nameKey;

    let targetIndex = -1;
    if (nameKey) {
      if (indexByStrongKey.has(strongKey)) {
        targetIndex = indexByStrongKey.get(strongKey)!;
      } else if (!dateKey && indexByLooseKey.has(looseKey)) {
        targetIndex = indexByLooseKey.get(looseKey)!;
      } else if (dateKey && indexByLooseKey.has(looseKey)) {
        const looseIndex = indexByLooseKey.get(looseKey)!;
        const looseDateKey = normalizeCompareText(merged[looseIndex]?.date || "");
        if (!looseDateKey) {
          targetIndex = looseIndex;
        }
      }
    }

    if (targetIndex < 0) {
      const next = { ...item };
      merged.push(next);
      const idx = merged.length - 1;
      if (nameKey) {
        indexByStrongKey.set(strongKey, idx);
        indexByLooseKey.set(looseKey, idx);
      }
      continue;
    }

    const target = merged[targetIndex];
    if ((!target.role?.trim() || isPlaceholderProjectRole(target.role)) && item.role?.trim()) {
      target.role = item.role;
    }
    if (!target.date?.trim() && item.date?.trim()) {
      target.date = item.date;
    }
    const extraLines = filterKnownLines(
      getProjectDetailLines(item),
      stripHtml(target.description || "")
    );
    if (extraLines.length) {
      target.description = mergeHtmlBullets(target.description || "", extraLines);
    }
  }

  return merged;
}

function absorbSupplementProjectDetails(
  projects: ResumeProjectItem[]
): ResumeProjectItem[] {
  const out: ResumeProjectItem[] = projects.map((item) => ({ ...item }));
  const toRemove = new Set<number>();

  for (let i = 0; i < out.length; i += 1) {
    const item = out[i];
    if (!isPlaceholderProjectName(item.name || "")) continue;
    const dateKey = normalizeCompareText(item.date || "");
    let targetIndex = out.findIndex((candidate, idx) => {
      if (idx === i || toRemove.has(idx)) return false;
      if (isPlaceholderProjectName(candidate.name || "")) return false;
      if (dateKey) {
        return normalizeCompareText(candidate.date || "") === dateKey;
      }
      return !stripHtml(candidate.description || "").trim();
    });

    if (targetIndex < 0) {
      targetIndex = out.findIndex(
        (candidate, idx) =>
          idx !== i &&
          !toRemove.has(idx) &&
          !isPlaceholderProjectName(candidate.name || "")
      );
    }
    if (targetIndex < 0) continue;

    const detailLines = getProjectDetailLines(item);
    if (detailLines.length) {
      appendProjectDetails(out, targetIndex, detailLines);
    }
    if (!out[targetIndex].date?.trim() && item.date?.trim()) {
      out[targetIndex].date = item.date;
    }
    if (
      (!out[targetIndex].role?.trim() ||
        isPlaceholderProjectRole(out[targetIndex].role)) &&
      item.role?.trim() &&
      !isPlaceholderProjectRole(item.role)
    ) {
      out[targetIndex].role = item.role;
    }
    toRemove.add(i);
  }

  return out.filter((_, idx) => !toRemove.has(idx));
}

function migrateProjectLikeExperienceItems(
  experience: ResumeExperienceItem[],
  projects: ResumeProjectItem[],
  isEnglish: boolean
): {
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
} {
  const keptExperience: ResumeExperienceItem[] = [];
  const nextProjects = [...projects];

  for (const item of experience) {
    const company = (item.company || "").trim();
    const position = (item.position || "").trim();
    const hasJobRole =
      EXPERIENCE_ROLE_PATTERN.test(position) ||
      SAFE_EXPERIENCE_ROLE_PATTERN.test(position);
    const projectHeaderLike = isLikelyProjectHeaderLine(company);
    const projectDetailLike = isLikelyProjectDetailLine(stripHtml(item.details || ""));
    const shouldMigrate =
      !!company &&
      !isLikelyOrganizationText(company) &&
      ((projectHeaderLike && (!hasJobRole || isPlaceholderPosition(position))) ||
        (!hasJobRole && projectDetailLike && company.length >= 8));

    if (!shouldMigrate) {
      keptExperience.push(item);
      continue;
    }

    let targetIndex = findBestProjectIndex(nextProjects, company);
    if (targetIndex < 0) {
      targetIndex = upsertProjectFromHint(
        nextProjects,
        company,
        extractDateInfoFromText(item.date || ""),
        isEnglish
      );
    }
    if (targetIndex < 0) {
      targetIndex = nextProjects.length;
      nextProjects.push({
        id: `proj_from_exp_${nextProjects.length}`,
        name: company,
        role: position || (isEnglish ? "To Confirm" : "待确认"),
        date: item.date || "",
        description: "",
        visible: true,
      });
    }

    if (!nextProjects[targetIndex].date?.trim() && item.date?.trim()) {
      nextProjects[targetIndex].date = item.date;
    }
    if (
      (!nextProjects[targetIndex].role?.trim() ||
        isPlaceholderProjectRole(nextProjects[targetIndex].role)) &&
      position &&
      !isPlaceholderPosition(position)
    ) {
      nextProjects[targetIndex].role = position;
    }
    appendProjectDetails(nextProjects, targetIndex, getExperienceDetailLines(item));
  }

  return {
    experience: keptExperience,
    projects: absorbSupplementProjectDetails(
      mergeDuplicateProjects(pruneEmptySupplementProjects(nextProjects))
    ),
  };
}

function applyExperienceUnmappedLines(
  experience: ResumeExperienceItem[],
  lines: string[],
  isEnglish: boolean
): string[] {
  const remaining: string[] = [];
  const detailsByIndex = new Map<number, string[]>();
  let activeIndex = -1;
  let linesSinceAnchor = Number.POSITIVE_INFINITY;

  for (const line of normalizeTextList(lines)) {
    const { content, dateInfo } = splitLineByDate(line);
    const checkText = content || line;
    const hasHeaderHint = isLikelyExperienceHeaderLine(checkText);
    const hasDetailHint = isLikelyWorkDetailLine(checkText);

    if (hasDetailHint) {
      let idx = -1;
      if (hasHeaderHint) {
        idx = upsertExperienceFromHint(
          experience,
          content,
          dateInfo,
          isEnglish
        );
      }
      if (idx < 0 && content) {
        idx = findBestExperienceIndex(experience, content);
      }
      if (idx < 0 && activeIndex >= 0 && linesSinceAnchor <= 14) {
        idx = activeIndex;
      }
      if (idx < 0 && dateInfo) {
        idx = upsertExperienceFromHint(experience, "", dateInfo, isEnglish);
      }
      if (idx < 0) {
        remaining.push(line);
        continue;
      }

      if (dateInfo && !hasExperienceDate(experience[idx].date)) {
        const display = formatDateRangeDisplay(dateInfo, isEnglish);
        if (display) {
          experience[idx].date = display;
        }
      }

      const detailText = content || line;
      const current = detailsByIndex.get(idx) || [];
      current.push(detailText);
      detailsByIndex.set(idx, current);
      activeIndex = idx;
      linesSinceAnchor += 1;
      continue;
    }

    if (hasHeaderHint) {
      const idx = upsertExperienceFromHint(
        experience,
        content,
        dateInfo,
        isEnglish
      );
      if (idx >= 0) {
        activeIndex = idx;
        linesSinceAnchor = 0;
      } else {
        remaining.push(line);
        linesSinceAnchor += 1;
      }
      continue;
    }

    if (dateInfo) {
      let idx = activeIndex;
      if (idx < 0 && content) {
        idx = findBestExperienceIndex(experience, content);
      }
      if (idx >= 0) {
        const display = formatDateRangeDisplay(dateInfo, isEnglish);
        if (display && !hasExperienceDate(experience[idx].date)) {
          experience[idx].date = display;
        }
        activeIndex = idx;
        linesSinceAnchor += 1;
        if (content) {
          remaining.push(content);
        }
        continue;
      }
      remaining.push(line);
      linesSinceAnchor += 1;
      continue;
    }

    remaining.push(line);
    linesSinceAnchor += 1;
  }

  for (const [index, detailLines] of detailsByIndex.entries()) {
    appendExperienceDetails(experience, index, detailLines);
  }

  return remaining;
}

function applyEducationDateHints(
  education: ResumeEducationItem[],
  lines: string[]
): string[] {
  const remaining: string[] = [];

  for (const line of normalizeTextList(lines)) {
    const { content, dateInfo } = splitLineByDate(line);
    if (!dateInfo) {
      remaining.push(line);
      continue;
    }

    const targetIndex =
      education.findIndex((item) => !item.startDate || !item.endDate) ??
      -1;
    if (targetIndex < 0) {
      remaining.push(line);
      continue;
    }

    const target = education[targetIndex];
    if (!target.startDate) {
      target.startDate = formatDateForSingleField(dateInfo.start);
    }
    if (!target.endDate) {
      target.endDate = formatDateForSingleField(dateInfo.end);
    }

    if (content) {
      remaining.push(content);
    }
  }

  return remaining;
}

function applyProjectUnmappedLines(
  projects: ResumeProjectItem[],
  lines: string[],
  isEnglish: boolean
): string[] {
  const remaining: string[] = [];
  const detailsByIndex = new Map<number, string[]>();
  let activeIndex = -1;
  let linesSinceAnchor = Number.POSITIVE_INFINITY;

  for (const line of normalizeTextList(lines)) {
    const { content, dateInfo } = splitLineByDate(line);
    const checkText = content || line;
    const hasHeaderHint = isLikelyProjectHeaderLine(checkText);
    const hasDetailHint = isLikelyProjectDetailLine(checkText);

    if (hasHeaderHint) {
      const idx = upsertProjectFromHint(projects, content, dateInfo, isEnglish);
      if (idx >= 0) {
        activeIndex = idx;
        linesSinceAnchor = 0;
      } else {
        remaining.push(line);
        linesSinceAnchor += 1;
      }
      continue;
    }

    if (hasDetailHint) {
      let idx = -1;
      if (content) {
        idx = findBestProjectIndex(projects, content);
      }
      if (idx < 0 && activeIndex >= 0 && linesSinceAnchor <= 14) {
        idx = activeIndex;
      }
      if (idx < 0 && dateInfo && projects.length === 0) {
        idx = upsertProjectFromHint(projects, "", dateInfo, isEnglish);
      }
      if (idx < 0 && projects.length > 0) {
        const display = dateInfo ? formatDateRangeDisplay(dateInfo, isEnglish) : "";
        if (display) {
          idx = projects.findIndex(
            (item) =>
              normalizeCompareText(item.date || "") === normalizeCompareText(display)
          );
        }
      }
      if (idx < 0 && projects.length > 0) {
        idx = projects.findIndex((item) => !stripHtml(item.description || "").trim());
        if (idx < 0) {
          idx = projects.length - 1;
        }
      }
      if (idx < 0) {
        remaining.push(line);
        linesSinceAnchor += 1;
        continue;
      }

      if (dateInfo && !hasExperienceDate(projects[idx].date)) {
        const display = formatDateRangeDisplay(dateInfo, isEnglish);
        if (display) {
          projects[idx].date = display;
        }
      }

      const detailText = content || line;
      const current = detailsByIndex.get(idx) || [];
      current.push(detailText);
      detailsByIndex.set(idx, current);
      activeIndex = idx;
      linesSinceAnchor += 1;
      continue;
    }

    if (dateInfo) {
      let idx = activeIndex;
      if (idx < 0 && content) {
        idx = findBestProjectIndex(projects, content);
      }
      if (idx < 0 && projects.length > 0) {
        const display = formatDateRangeDisplay(dateInfo, isEnglish);
        idx = projects.findIndex(
          (item) =>
            normalizeCompareText(item.date || "") === normalizeCompareText(display)
        );
      }
      if (idx < 0 && projects.length > 0) {
        idx = projects.findIndex((item) => !hasExperienceDate(item.date));
        if (idx < 0) {
          idx = projects.length - 1;
        }
      }
      if (idx >= 0) {
        const display = formatDateRangeDisplay(dateInfo, isEnglish);
        if (display && !hasExperienceDate(projects[idx].date)) {
          projects[idx].date = display;
        }
        activeIndex = idx;
        linesSinceAnchor += 1;
        if (content && !isLikelyProjectHeaderLine(content)) {
          const current = detailsByIndex.get(idx) || [];
          current.push(content);
          detailsByIndex.set(idx, current);
        }
        continue;
      }

      remaining.push(line);
      linesSinceAnchor += 1;
      continue;
    }

    if (activeIndex >= 0 && linesSinceAnchor <= 12 && checkText.length >= 6) {
      const current = detailsByIndex.get(activeIndex) || [];
      current.push(checkText);
      detailsByIndex.set(activeIndex, current);
      linesSinceAnchor += 1;
      continue;
    }

    remaining.push(line);
    linesSinceAnchor += 1;
  }

  for (const [index, detailLines] of detailsByIndex.entries()) {
    appendProjectDetails(projects, index, detailLines);
  }

  return remaining;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function toBulletHtml(lines: string[]): string {
  if (!lines.length) return "";
  const items = lines
    .map((line) => `<li><p>${escapeHtml(line)}</p></li>`)
    .join("");
  return `<ul>${items}</ul>`;
}

function normalizeCompareText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[,\.\?!;:\/\\|()\[\]{}<>'"`~@#$%^&*+=\-_]/g, "")
    .trim();
}

function inferIsEnglish(existing?: Partial<ResumeData>): boolean {
  const sections = existing?.menuSections || [];
  return sections.some((section) =>
    /profile|skills|experience|projects|education/i.test(section.title || "")
  );
}

function getSectionTitle(sectionId: string, isEnglish: boolean): string {
  const zh: Record<string, string> = {
    basic: "基本信息",
    skills: "专业技能",
    experience: "工作经验",
    projects: "项目经历",
    education: "教育经历",
    [IMPORT_EXTRA_SECTION_ID]: "补充信息",
  };
  const en: Record<string, string> = {
    basic: "Profile",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    [IMPORT_EXTRA_SECTION_ID]: "Imported Extra",
  };
  return (isEnglish ? en : zh)[sectionId] || sectionId;
}

function buildImportedExtraItems(
  _profile: ResumeProfile,
  _isEnglish: boolean
): CustomItem[] {
  // open_questions is for operator review, not resume content.
  return [];
}

function classifyAiCategory(
  line: string
): { key: string; titleZh: string; titleEn: string } {
  for (const rule of AI_CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(line))) {
      return { key: rule.key, titleZh: rule.zh, titleEn: rule.en };
    }
  }
  return { key: "other", titleZh: "其他", titleEn: "Other" };
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function routeUnmappedLines(
  lines: string[],
  isEnglish: boolean
): RoutedUnmapped {
  const routed: RoutedUnmapped = {
    skills: [],
    experience: [],
    education: [],
    projects: [],
    custom: {},
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isSystemDiagnosticLine(line)) continue;
    const { content, dateInfo } = splitLineByDate(line);
    const checkText = content || line;
    if (SECTION_TITLE_ONLY_PATTERN.test(checkText) || SAFE_SECTION_TITLE_ONLY_PATTERN.test(checkText)) {
      continue;
    }
    const hasEducationHint =
      matchesAnyPattern(checkText, [...MODULE_PATTERNS.education]) ||
      EDUCATION_HEADER_PATTERN.test(checkText) ||
      SAFE_EDUCATION_HEADER_PATTERN.test(checkText);
    const hasProjectHint =
      matchesAnyPattern(checkText, [...MODULE_PATTERNS.projects]) ||
      PROJECT_HEADER_PATTERN.test(checkText) ||
      SAFE_PROJECT_HEADER_PATTERN.test(checkText);
    const hasResearchHint =
      RESEARCH_HEADER_PATTERN.test(checkText) ||
      RESEARCH_DETAIL_PATTERN.test(checkText) ||
      SAFE_RESEARCH_HEADER_PATTERN.test(checkText) ||
      SAFE_RESEARCH_DETAIL_PATTERN.test(checkText);
    const hasStrongExperienceHint =
      EXPERIENCE_STRONG_PATTERN.test(checkText) ||
      SAFE_EXPERIENCE_STRONG_PATTERN.test(checkText) ||
      isLikelyExperienceHeaderLine(checkText);
    const hasGenericExperienceHint = matchesAnyPattern(checkText, [
      ...MODULE_PATTERNS.experience,
    ]);
    const hasWorkDetailHint = isLikelyWorkDetailLine(checkText);
    const projectDominant = isProjectDominantLine(checkText);

    if (hasEducationHint) {
      routed.education.push(line);
      continue;
    }

    if (hasResearchHint && !hasStrongExperienceHint) {
      routed.projects.push(line);
      continue;
    }

    // Project lines may include action verbs (负责/优化/开发), so project-dominant text takes priority.
    if (hasProjectHint && (projectDominant || !hasStrongExperienceHint)) {
      routed.projects.push(line);
      continue;
    }

    if (hasStrongExperienceHint || hasGenericExperienceHint) {
      routed.experience.push(line);
      continue;
    }

    if (hasProjectHint && hasWorkDetailHint) {
      routed.projects.push(line);
      continue;
    }

    if (hasWorkDetailHint) {
      routed.experience.push(line);
      continue;
    }

    if (hasProjectHint) {
      routed.projects.push(line);
      continue;
    }

    if (matchesAnyPattern(checkText, [...MODULE_PATTERNS.skills])) {
      routed.skills.push(line);
      continue;
    }

    if (dateInfo) {
      // Pure date lines and date+header lines are routed to core sections first.
      if (EDUCATION_HEADER_PATTERN.test(checkText) || SAFE_EDUCATION_HEADER_PATTERN.test(checkText)) {
        routed.education.push(line);
      } else if (hasResearchHint) {
        routed.projects.push(line);
      } else if (PROJECT_HEADER_PATTERN.test(checkText) || SAFE_PROJECT_HEADER_PATTERN.test(checkText)) {
        routed.projects.push(line);
      } else {
        routed.experience.push(line);
      }
      continue;
    }

    const category = classifyAiCategory(line);
    const sectionId = `${AI_SECTION_PREFIX}${category.key}`;
    const sectionTitle = `${isEnglish ? "AI Category" : "AI归类"}-${
      isEnglish ? category.titleEn : category.titleZh
    }`;
    if (!routed.custom[sectionId]) {
      routed.custom[sectionId] = { title: sectionTitle, lines: [] };
    }
    routed.custom[sectionId].lines.push(line);
  }

  for (const key of ["skills", "experience", "education", "projects"] as const) {
    routed[key] = normalizeTextList(routed[key]);
  }

  for (const [sectionId, section] of Object.entries(routed.custom)) {
    routed.custom[sectionId].lines = normalizeTextList(section.lines);
  }

  return routed;
}

function mergeHtmlBullets(existingHtml: string, lines: string[]): string {
  if (!lines.length) return existingHtml;
  const extra = toBulletHtml(lines);
  if (!existingHtml.trim()) return extra;
  return `${existingHtml}\n${extra}`;
}

function filterKnownLines(lines: string[], knownText: string): string[] {
  const known = normalizeCompareText(knownText);
  if (!known) return normalizeTextList(lines);
  return normalizeTextList(lines).filter((line) => {
    const token = normalizeCompareText(line);
    return token && !known.includes(token);
  });
}

function isSystemDiagnosticLine(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  if (
    lower.startsWith("llm did not return valid json") ||
    lower.startsWith("llm reason:") ||
    lower.includes("fallback parsing was used") ||
    lower.includes("fallback mode") ||
    lower.includes("please review imported sections manually") ||
    lower.includes("failed to parse llm json output") ||
    lower.includes("after repair retry") ||
    lower.includes("first output preview") ||
    (lower.includes("detected ") &&
      lower.includes(" source lines") &&
      lower.includes("unmapped")) ||
    lower.includes("review ai classified sections") ||
    lower.includes("authenticationerror") ||
    lower.includes("invalid api key") ||
    lower.includes("status_code=") ||
    lower.includes("litellm.authenticationerror")
  ) {
    return true;
  }

  if (
    (lower.includes("\"basics\"") || lower.includes("\"work_experience\"")) &&
    (text.includes("{") || text.includes("}"))
  ) {
    return true;
  }

  return false;
}

function isLikelySkillLine(raw: string): boolean {
  const line = raw.trim();
  if (!line) return false;
  if (isSystemDiagnosticLine(line)) return false;

  const { content, dateInfo } = splitLineByDate(line);
  const text = (content || line).trim();
  if (!text || dateInfo) return false;

  if (
    isLikelyProjectHeaderLine(text) ||
    isLikelyProjectDetailLine(text) ||
    isLikelyExperienceHeaderLine(text)
  ) {
    return false;
  }
  if (
    EDUCATION_HEADER_PATTERN.test(text) ||
    SAFE_EDUCATION_HEADER_PATTERN.test(text)
  ) {
    return false;
  }
  if (
    isLikelyWorkDetailLine(text) &&
    text.length >= 26 &&
    /[。；;.!?]/.test(text)
  ) {
    return false;
  }

  const hasSkillKeyword = MODULE_PATTERNS.skills.some((pattern) =>
    pattern.test(text)
  );
  const hasSkillSeparator = /[,/|、，]\s*/.test(text);
  if (!hasSkillKeyword && !hasSkillSeparator) return false;
  return text.length <= 120;
}

function removeAiSections(
  existing?: Partial<ResumeData>
): {
  menuSections: ResumeData["menuSections"];
  customData: ResumeData["customData"];
} {
  const menuSections = (existing?.menuSections || []).filter(
    (section) =>
      section.id !== IMPORT_EXTRA_SECTION_ID &&
      !section.id.startsWith(AI_SECTION_PREFIX)
  );

  const customData = Object.fromEntries(
    Object.entries(existing?.customData || {}).filter(
      ([sectionId]) =>
        sectionId !== IMPORT_EXTRA_SECTION_ID &&
        !sectionId.startsWith(AI_SECTION_PREFIX)
    )
  ) as ResumeData["customData"];

  return { menuSections, customData };
}

function getSectionSortRank(sectionId: string): number {
  switch (sectionId) {
    case "basic":
      return 0;
    case "skills":
      return 1;
    case "experience":
      return 2;
    case "projects":
      return 3;
    case "education":
      return 4;
    default:
      if (sectionId.startsWith(AI_SECTION_PREFIX)) return 5;
      if (sectionId === IMPORT_EXTRA_SECTION_ID) return 6;
      return 999;
  }
}

function ensureMenuSections(
  existing: Partial<ResumeData> | undefined,
  hasSectionData: Record<string, boolean>
): ResumeData["menuSections"] {
  const isEnglish = inferIsEnglish(existing);
  const current = [...(existing?.menuSections || [])];
  const byId = new Map(current.map((section) => [section.id, { ...section }]));

  for (const [id, hasData] of Object.entries(hasSectionData)) {
    if (!hasData) continue;
    const existingSection = byId.get(id);
    if (existingSection) {
      existingSection.enabled = true;
      continue;
    }
    byId.set(id, {
      id,
      title: getSectionTitle(id, isEnglish),
      icon: "*",
      enabled: true,
      order: 999,
    });
  }

  const sorted = Array.from(byId.values()).sort((a, b) => {
    const ar = getSectionSortRank(a.id);
    const br = getSectionSortRank(b.id);
    if (ar !== br) return ar - br;
    return (a.order ?? 999) - (b.order ?? 999);
  });

  return sorted.map((section, idx) => ({
    ...section,
    order: idx,
  }));
}

/**
 * 去除HTML标签
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * 将 Tiptap HTML 经验详情转为结构化 responsibilities
 */
function htmlToResponsibilities(
  detailsHtml: string
): ResumeProfile["work_experience"][0]["responsibilities"] {
  if (!detailsHtml) return [];

  // 提取 <li> 中的内容
  const liRegex = /<li[^>]*>(.*?)<\/li>/gs;
  let items: string[] = [];
  let match;
  while ((match = liRegex.exec(detailsHtml)) !== null) {
    items.push(match[1]);
  }

  // 没有列表项，按 <p> 分割
  if (items.length === 0) {
    items = detailsHtml
      .split(/<\/?p[^>]*>/)
      .filter((s) => s.trim().length > 0);
  }

  if (items.length === 0 && detailsHtml.trim()) {
    items = [detailsHtml];
  }

  return items.map((item) => ({
    category: "",
    description: stripHtml(item),
    metrics: [],
    keywords: [],
  }));
}

/**
 * 将结构化 responsibilities 转为 Tiptap HTML
 */
function responsibilitiesToHtml(
  responsibilities: ResumeProfile["work_experience"][0]["responsibilities"]
): string {
  if (!responsibilities || responsibilities.length === 0) return "";
  const items = responsibilities
    .map((r) => {
      let desc = r.description;
      if (r.metrics && r.metrics.length > 0) {
        desc += ` (${r.metrics.join(", ")})`;
      }
      return `<li><p>${desc}</p></li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

/**
 * 解析日期范围字符串
 */
function parseDateRange(dateStr: string): [string, string] {
  if (!dateStr) return ["", ""];
  const extracted = extractDateInfoFromText(dateStr);
  if (extracted) {
    return [
      formatDateForBackend(extracted.start),
      formatDateForBackend(extracted.end),
    ];
  }

  const parts = dateStr.split(/\s*(?:-|~|to)\s*/i);
  const parsedStart = formatDateForBackend(parseDateToken(parts[0] || ""));
  const parsedEnd = formatDateForBackend(parseDateToken(parts[1] || ""));

  return [
    parsedStart || parts[0]?.trim() || "",
    parsedEnd || parts[1]?.trim() || "",
  ];
}

/**
 * 将技能 HTML 转为分类数组
 */
function skillsHtmlToCategories(
  skillHtml: string
): Record<string, string[]> {
  const text = stripHtml(skillHtml);
  if (!text) return {};
  const items = text
    .split(/[;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { other: items };
}

/**
 * 将分类技能转为 HTML
 */
function skillsCategoriesToHtml(
  skills: Record<string, string[] | Array<{ language: string; level: string }>>
): string {
  const allSkills: string[] = [];
  for (const items of Object.values(skills)) {
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === "string") {
          allSkills.push(item);
        } else if (item && typeof item === "object" && "language" in item) {
          allSkills.push(`${item.language}: ${item.level}`);
        }
      }
    }
  }
  if (allSkills.length === 0) return "";
  const itemsHtml = allSkills.map((s) => `<li><p>${s}</p></li>`).join("");
  return `<ul>${itemsHtml}</ul>`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toUnknownList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickFirstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function pickPeriodDate(periods: unknown, edge: "start" | "end"): string {
  const entries = toUnknownList(periods).map(asObject).filter((item) => Object.keys(item).length > 0);
  if (!entries.length) return "";
  const target = edge === "start" ? entries[0] : entries[entries.length - 1];
  return edge === "start"
    ? pickFirstText(target.start, target.from, target.date)
    : pickFirstText(target.end, target.to, target.date);
}

function normalizeResponsibilitiesFromAny(
  rawItem: Record<string, unknown>
): ResumeProfile["work_experience"][0]["responsibilities"] {
  const normalized: ResumeProfile["work_experience"][0]["responsibilities"] = [];
  const rawResponsibilities = toUnknownList(rawItem.responsibilities);

  for (const raw of rawResponsibilities) {
    if (typeof raw === "string" && raw.trim()) {
      normalized.push({
        category: "",
        description: raw.trim(),
        metrics: [],
        keywords: [],
      });
      continue;
    }

    const item = asObject(raw);
    const description = pickFirstText(
      item.description,
      item.content,
      item.text,
      item.detail,
      item.highlight
    );
    if (!description) continue;

    normalized.push({
      category: pickFirstText(item.category),
      description,
      metrics: normalizeTextList(toUnknownList(item.metrics)),
      keywords: normalizeTextList(toUnknownList(item.keywords)),
    });
  }

  if (normalized.length) return normalized;

  const fallbackList = normalizeTextList([
    ...toUnknownList(rawItem.highlights),
    ...toUnknownList(rawItem.achievements),
    ...toUnknownList(rawItem.bullets),
  ]);

  if (fallbackList.length) {
    return fallbackList.map((line) => ({
      category: "",
      description: line,
      metrics: [],
      keywords: [],
    }));
  }

  const fallbackBlob = pickFirstText(rawItem.details, rawItem.description, rawItem.summary);
  const fallbackLines = fallbackBlob
    ? normalizeTextList(fallbackBlob.split(/\r?\n|[;；]+/g))
    : [];
  return fallbackLines.map((line) => ({
    category: "",
    description: line,
    metrics: [],
    keywords: [],
  }));
}

/**
 * Resume Assistant ResumeData -> Agent ResumeProfile
 */
export function toResumeProfile(data: ResumeData): ResumeProfile {
  const education = (data.education || []).map((edu: Education) => ({
    school: edu.school,
    degree_type: edu.degree,
    major: edu.major,
    start_date: formatDateForBackend(parseDateToken(edu.startDate || "")),
    end_date: formatDateForBackend(parseDateToken(edu.endDate || "")),
    gpa: edu.gpa || null,
    courses: [] as string[],
    awards: [] as string[],
  }));

  const workExperience = (data.experience || []).map((exp: Experience) => {
    const [start, end] = parseDateRange(exp.date);
    return {
      company: exp.company,
      role: exp.position,
      start_date: start,
      end_date: end,
      is_internship: false,
      responsibilities: htmlToResponsibilities(exp.details),
    };
  });

  const research = (data.projects || []).map((proj: Project) => {
    const [start, end] = parseDateRange(proj.date);
    return {
      title: proj.name,
      type: "项目",
      start_date: start,
      end_date: end,
      description: stripHtml(proj.description),
      contributions: proj.role,
    };
  });

  return {
    basics: {
      name: data.basic?.name || "",
      phone: data.basic?.phone || null,
      email: data.basic?.email || null,
      degree: education[0]?.degree_type || null,
      target_role: data.basic?.title || null,
      summary: null,
    },
    education,
    work_experience: workExperience,
    research,
    skills: skillsHtmlToCategories(data.skillContent || ""),
    metadata: {
      source_format: "magic_resume",
      version: 1,
    },
  };
}

/**
 * Agent ResumeProfile -> Resume Assistant ResumeData (partial)
 * 合并到现有简历中，保留设置和布局
 */
export function fromResumeProfile(
  profile: ResumeProfile,
  existing?: Partial<ResumeData>
): Partial<ResumeData> {
  const isEnglish = inferIsEnglish(existing);
  const { menuSections: cleanedMenuSections, customData: cleanedCustomData } =
    removeAiSections(existing);

  const basic = {
    name: profile.basics.name || "",
    title: profile.basics.target_role || "",
    email: profile.basics.email || "",
    phone: profile.basics.phone || "",
    location: "",
    birthDate: "",
    employementStatus: "",
    photo: "",
    customFields: [],
    icons: {},
    githubKey: "",
    githubUseName: "",
    githubContributionsVisible: false,
    ...(existing?.basic || {}),
    // 覆盖内容字段
    ...(profile.basics.name ? { name: profile.basics.name } : {}),
    ...(profile.basics.email ? { email: profile.basics.email } : {}),
    ...(profile.basics.phone ? { phone: profile.basics.phone } : {}),
    ...(profile.basics.target_role ? { title: profile.basics.target_role } : {}),
  };

  const education = (profile.education || []).map((rawEdu, i) => {
    const edu = asObject(rawEdu);
    return {
      id: `edu_${i}`,
      school: pickFirstText(edu.school, edu.university, edu.college),
      major: pickFirstText(edu.major, edu.field, edu.specialization),
      degree: pickFirstText(edu.degree_type, edu.degree),
      startDate: formatDateForSingleField(
        parseDateToken(pickFirstText(edu.start_date, edu.start, edu.from))
      ),
      endDate: formatDateForSingleField(
        parseDateToken(pickFirstText(edu.end_date, edu.end, edu.to))
      ),
      gpa: pickFirstText(edu.gpa),
      description: "",
      visible: true,
    };
  });

  let experience = (profile.work_experience || []).map((rawExp, i) => {
    const exp = asObject(rawExp);
    const startDate = pickFirstText(
      exp.start_date,
      exp.start,
      exp.from,
      pickPeriodDate(exp.periods, "start")
    );
    const endDate = pickFirstText(
      exp.end_date,
      exp.end,
      exp.to,
      pickPeriodDate(exp.periods, "end")
    );
    const responsibilities = normalizeResponsibilitiesFromAny(exp);

    return {
      id: `exp_${i}`,
      company: pickFirstText(exp.company, exp.organization, exp.employer),
      position: pickFirstText(exp.role, exp.title, exp.position, exp.job_title),
      date: normalizeDateRangeFromFields(startDate, endDate, isEnglish),
      details: responsibilitiesToHtml(responsibilities),
      visible: true,
    };
  });
  experience = mergeDuplicateExperienceItems(experience);

  let projects = (profile.research || []).map((rawRes, i) => {
    const res = asObject(rawRes);
    const description = pickFirstText(res.description, res.summary);
    return {
      id: `proj_${i}`,
      name: pickFirstText(res.title, res.name),
      role: pickFirstText(res.contributions, res.role),
      date: normalizeDateRangeFromFields(
        pickFirstText(res.start_date, res.start, res.from),
        pickFirstText(res.end_date, res.end, res.to),
        isEnglish
      ),
      description: description ? `<p>${description}</p>` : "",
      visible: true,
    };
  });

  ({ experience, projects } = migrateProjectLikeExperienceItems(
    experience,
    projects,
    isEnglish
  ));

  experience = pruneEmptySupplementExperiences(
    mergeDuplicateExperienceItems(experience)
  );
  projects = absorbSupplementProjectDetails(
    mergeDuplicateProjects(pruneEmptySupplementProjects(projects))
  );
  const skillContent = skillsCategoriesToHtml(profile.skills || {});
  const customData = {
    ...cleanedCustomData,
  };

  const existingForMenu: Partial<ResumeData> = {
    ...(existing || {}),
    menuSections: [...cleanedMenuSections],
  };

  const hasSectionData: Record<string, boolean> = {
    basic: true,
    skills: !!skillContent.trim(),
    experience: experience.length > 0,
    projects: projects.length > 0,
    education: education.length > 0,
  }

  const menuSections = ensureMenuSections(existingForMenu, hasSectionData);

  return {
    ...(existing || {}),
    basic: basic as ResumeData["basic"],
    education,
    experience,
    projects,
    skillContent,
    customData,
    menuSections,
  };
}

