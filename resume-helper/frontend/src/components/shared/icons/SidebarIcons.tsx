import React from "react";
import {
  FileText,
  LayoutGrid,
  Layers,
  Settings,
} from "lucide-react";

interface IconProps {
  size?: number;
  className?: string;
  active?: boolean;
}

const iconTone = (active?: boolean) => (active ? "#3F67D6" : "#64748B");

export const IconResumes: React.FC<IconProps> = ({
  size = 20,
  className,
  active,
}) => (
  <FileText
    size={size}
    className={className}
    color={iconTone(active)}
    strokeWidth={2}
  />
);

export const IconTemplates: React.FC<IconProps> = ({
  size = 20,
  className,
  active,
}) => (
  <LayoutGrid
    size={size}
    className={className}
    color={iconTone(active)}
    strokeWidth={2}
  />
);

export const IconService: React.FC<IconProps> = ({
  size = 20,
  className,
  active,
}) => (
  <Layers
    size={size}
    className={className}
    color={iconTone(active)}
    strokeWidth={2}
  />
);

export const IconSettings: React.FC<IconProps> = ({
  size = 20,
  className,
  active,
}) => (
  <Settings
    size={size}
    className={className}
    color={iconTone(active)}
    strokeWidth={2}
  />
);
