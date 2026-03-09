import { useLocale } from "@/i18n/compat/client";
import { FileUp, FileText, Send } from "lucide-react";
import AnimatedFeature from "./client/AnimatedFeature";

type Step = {
  title: string;
  desc: string;
  icon: typeof FileUp;
};

const stepsByLocale: Record<"zh" | "en", Step[]> = {
  zh: [
    {
      title: "导入简历和岗位",
      desc: "支持从现有简历开始，也可直接新建并填写目标岗位信息。",
      icon: FileUp
    },
    {
      title: "AI 智能优化",
      desc: "一键完成关键词覆盖分析、语义润色与 ATS 审核建议。",
      icon: FileText
    },
    {
      title: "导出投递",
      desc: "实时预览后导出 PDF，快速完成投递准备。",
      icon: Send
    }
  ],
  en: [
    {
      title: "Import Resume & JD",
      desc: "Start from your existing resume or build one from scratch with target role details.",
      icon: FileUp
    },
    {
      title: "AI Optimization",
      desc: "Run keyword coverage, polish phrasing, and ATS-oriented checks in one flow.",
      icon: FileText
    },
    {
      title: "Export & Apply",
      desc: "Preview in real time and export PDF for immediate applications.",
      icon: Send
    }
  ]
};

export default function WorkflowSection() {
  const locale = useLocale() === "en" ? "en" : "zh";
  const steps = stepsByLocale[locale];
  const sectionTitle = locale === "en" ? "How It Works" : "三步完成简历优化";
  const sectionSubtitle =
    locale === "en"
      ? "A focused workflow for fast, high-quality resume delivery."
      : "用结构化流程，快速产出可投递的高质量简历。";

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-6 max-w-6xl">
        <AnimatedFeature>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-serif font-semibold tracking-tight text-foreground/90">
              {sectionTitle}
            </h2>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              {sectionSubtitle}
            </p>
          </div>
        </AnimatedFeature>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <AnimatedFeature key={step.title} delay={0.1 * index}>
              <article className="h-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-6">{step.desc}</p>
              </article>
            </AnimatedFeature>
          ))}
        </div>
      </div>
    </section>
  );
}
