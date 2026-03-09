import type * as React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

const IconGemini = ({ size = 24, className = "", ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <title>Google Gemini</title>
    <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z" fill="currentColor"/>
  </svg>
);

export default IconGemini;
