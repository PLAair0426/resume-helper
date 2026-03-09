/**
 * Provider icon registry.
 * We intentionally return empty icons to remove AI-brand visual symbols.
 */
import type { ComponentType, SVGProps } from "react";
import type { AIModelType } from "@/config/ai";

export type ProviderIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  className?: string;
};

const NoProviderIcon: ComponentType<ProviderIconProps> = () => null;

export const PROVIDER_ICONS: Record<
  AIModelType,
  ComponentType<ProviderIconProps>
> = {
  deepseek: NoProviderIcon,
  doubao: NoProviderIcon,
  openai: NoProviderIcon,
  anthropic: NoProviderIcon,
  gemini: NoProviderIcon,
  qwen: NoProviderIcon,
  zhipu: NoProviderIcon,
  moonshot: NoProviderIcon,
  baichuan: NoProviderIcon,
  yi: NoProviderIcon,
  minimax: NoProviderIcon,
  spark: NoProviderIcon,
  stepfun: NoProviderIcon,
  siliconflow: NoProviderIcon,
  groq: NoProviderIcon,
  mistral: NoProviderIcon,
};
