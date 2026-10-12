import React from "react";

/** A sphere whose equator is solid in front and dashed behind. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.6" />
      <path d="M2.4 12a9.6 3.7 0 0 0 19.2 0" />
      <path d="M2.4 12a9.6 3.7 0 0 1 19.2 0" strokeDasharray="1.9 2.1" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark />
      <span className="logo-word">HLR SVG</span>
    </span>
  );
}
