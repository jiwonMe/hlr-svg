import React from "react";
import type { ObjectKind } from "./model";

/** Line icons in the same solid/dashed language as the figures. */
export function KindIcon({
  kind,
  size = 18,
}: {
  kind: ObjectKind;
  size?: number;
}) {
  return (
    <svg
      className="ed-kind-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "sphere" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12a8.5 3.2 0 0 0 17 0" />
          <path d="M3.5 12a8.5 3.2 0 0 1 17 0" strokeDasharray="1.6 1.8" />
        </>
      )}
      {kind === "cylinder" && (
        <>
          <ellipse cx="12" cy="5.5" rx="6.5" ry="2.4" />
          <path d="M5.5 5.5v13M18.5 5.5v13M5.5 18.5a6.5 2.4 0 0 0 13 0" />
          <path d="M5.5 18.5a6.5 2.4 0 0 1 13 0" strokeDasharray="1.6 1.8" />
        </>
      )}
      {kind === "cone" && (
        <>
          <path d="M12 3.5 5 18.5M12 3.5l7 15M5 18.5a7 2.5 0 0 0 14 0" />
          <path d="M5 18.5a7 2.5 0 0 1 14 0" strokeDasharray="1.6 1.8" />
        </>
      )}
      {kind === "box" && (
        <>
          <path d="M4 8.5 12 4.5l8 4v8.5l-8 4-8-4zM4 8.5l8 4 8-4M12 12.5V21" />
          <path d="M12 4.5v0" />
        </>
      )}
      {kind === "plane" && <path d="M3 15.5 8.5 7.5h12.5L15.5 15.5z" />}
      {kind === "disk" && <ellipse cx="12" cy="12" rx="8.5" ry="4" />}
      {kind === "point" && (
        <>
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5h3" opacity=".55" />
        </>
      )}
      {kind === "segment" && (
        <>
          <path d="M5 18 19 6" />
          <circle cx="5" cy="18" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="19" cy="6" r="1.8" fill="currentColor" stroke="none" />
        </>
      )}
      {kind === "face" && <path d="M4 18.5 10 5l10 10.5z" />}
    </svg>
  );
}
