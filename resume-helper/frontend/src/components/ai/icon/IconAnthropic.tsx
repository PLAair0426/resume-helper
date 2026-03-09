import type * as React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

const IconAnthropic = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Anthropic</title>
    <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.257 0h3.603L16.743 20.48h-3.603L6.57 3.52zM3.48 20.48L10.05 3.52h3.603L7.083 20.48H3.48z" fill="currentColor"/>
  </svg>
);

export default IconAnthropic;
