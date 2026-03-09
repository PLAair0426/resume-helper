/**
 * AI Provider Icons
 * 使用简洁的品牌首字母/缩写作为图标
 */
import type * as React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

// 通义千问 (Alibaba Qwen)
export const IconQwen = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Qwen</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">Q</text>
  </svg>
);

// 智谱 GLM
export const IconZhipu = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Zhipu GLM</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">智</text>
  </svg>
);

// 月之暗面 Moonshot (Kimi)
export const IconMoonshot = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Moonshot</title>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.82 0 3.53-.49 5-1.35C14.36 19.44 12 16.97 12 14c0-3.87 2.55-7.14 6.06-8.22C16.61 3.33 14.42 2 12 2z" fill="currentColor"/>
  </svg>
);

// 百川 Baichuan
export const IconBaichuan = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Baichuan</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">百</text>
  </svg>
);

// 零一万物 Yi
export const IconYi = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Yi</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">Yi</text>
  </svg>
);

// MiniMax
export const IconMinimax = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>MiniMax</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">MM</text>
  </svg>
);

// 讯飞星火 Spark
export const IconSpark = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Spark</title>
    <path d="M13 2L4.5 14h4.5l-2 8L18.5 9H13.5l2.5-7z" fill="currentColor"/>
  </svg>
);

// 阶跃星辰 StepFun
export const IconStepfun = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>StepFun</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">阶</text>
  </svg>
);

// 硅基流动 SiliconFlow
export const IconSiliconflow = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>SiliconFlow</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">SF</text>
  </svg>
);

// Groq
export const IconGroq = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Groq</title>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>
    <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">G</text>
  </svg>
);

// Mistral
export const IconMistral = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Mistral</title>
    <rect x="2" y="2" width="5" height="5" fill="currentColor"/>
    <rect x="17" y="2" width="5" height="5" fill="currentColor"/>
    <rect x="2" y="9.5" width="5" height="5" fill="currentColor"/>
    <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor"/>
    <rect x="17" y="9.5" width="5" height="5" fill="currentColor"/>
    <rect x="2" y="17" width="5" height="5" fill="currentColor"/>
    <rect x="17" y="17" width="5" height="5" fill="currentColor"/>
  </svg>
);
