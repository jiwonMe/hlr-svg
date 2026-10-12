import React from "react";
import type { ObjectKind } from "./model";
import type { ToolId } from "./tools";

const dash = "1.6 1.8";

const UNION = "M12 6.8A6 6 0 1 0 12 17.2A6 6 0 1 0 12 6.8Z";
const LENS = "M12 6.8A6 6 0 0 1 12 17.2A6 6 0 0 1 12 6.8Z";

/** Line drawings in the figures' own solid/dashed language. */
const GLYPHS: Record<ObjectKind | ToolId, React.ReactNode> = {
  sphere: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12a8.5 3.2 0 0 0 17 0" />
      <path d="M3.5 12a8.5 3.2 0 0 1 17 0" strokeDasharray={dash} />
    </>
  ),
  cylinder: (
    <>
      <ellipse cx="12" cy="5.5" rx="6.5" ry="2.4" />
      <path d="M5.5 5.5v13M18.5 5.5v13M5.5 18.5a6.5 2.4 0 0 0 13 0" />
      <path d="M5.5 18.5a6.5 2.4 0 0 1 13 0" strokeDasharray={dash} />
    </>
  ),
  cone: (
    <>
      <path d="M12 3.5 5 18.5M12 3.5l7 15M5 18.5a7 2.5 0 0 0 14 0" />
      <path d="M5 18.5a7 2.5 0 0 1 14 0" strokeDasharray={dash} />
    </>
  ),
  box: <path d="M4 8.5 12 4.5l8 4v8.5l-8 4-8-4zM4 8.5l8 4 8-4M12 12.5V21" />,
  plane: <path d="M3 15.5 8.5 7.5h12.5L15.5 15.5z" />,
  disk: <ellipse cx="12" cy="12" rx="8.5" ry="4" />,
  boolean: (
    <>
      <path d={UNION} />
      <path d={LENS} strokeDasharray={dash} />
    </>
  ),
  point: (
    <>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5h3" opacity=".55" />
    </>
  ),
  segment: (
    <>
      <path d="M5 18 19 6" />
      <circle cx="5" cy="18" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="6" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  face: <path d="M4 18.5 10 5l10 10.5z" />,
  angle: <path d="M4.5 18.5H20M4.5 18.5 16 6M12 18.5a7.5 7.5 0 0 0-2.3-5.4" />,
  measure: (
    <>
      <path d="M4 17.5h16M4 15v5M20 15v5" />
      <path d="M8 9.5l1.6 2.6L12.4 5H16" />
    </>
  ),
  midpoint: (
    <>
      <path d="M4 18 20 6" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M7 13.5l1.5 1.8M15.5 7.4l1.5 1.8" />
    </>
  ),
  foot: (
    <>
      <path d="M3 19.5h18" />
      <path d="M12 5.5v14" strokeDasharray={dash} />
      <path d="M12 16.5h3v3" />
      <circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  intersection: (
    <>
      <path d="M3 17.5 8 11h13l-5 6.5z" />
      <path d="M12 3v11" />
      <path d="M12 14.5V21" strokeDasharray={dash} />
      <circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  center: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  onSegment: (
    <>
      <path d="M4 18 20 6" />
      <circle cx="9.3" cy="14" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  onSphere: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="17.7" cy="6.3" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  onPlane: (
    <>
      <path d="M3 17 8 9h13l-5 8z" />
      <circle cx="12.4" cy="13" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  union: (
    <>
      <path d={UNION} />
      <path d={LENS} strokeDasharray={dash} />
    </>
  ),
  subtract: (
    <>
      <path d="M12 6.8A6 6 0 1 0 12 17.2A6 6 0 0 1 12 6.8Z" />
      <path d="M12 6.8A6 6 0 1 1 12 17.2" strokeDasharray={dash} />
    </>
  ),
  intersect: (
    <>
      <path d={LENS} />
      <path
        d="M12 6.8A6 6 0 1 0 12 17.2M12 6.8A6 6 0 1 1 12 17.2"
        strokeDasharray={dash}
      />
    </>
  ),
};

export function Glyph({
  name,
  size = 18,
}: {
  name: ObjectKind | ToolId;
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
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}

export function KindIcon({ kind, size }: { kind: ObjectKind; size?: number }) {
  return <Glyph name={kind} size={size} />;
}
