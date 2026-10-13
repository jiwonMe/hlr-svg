import { useSyncExternalStore } from "react";

/*
 * Figure labels typeset by i.upmath.me, the service behind upmath.js. Each
 * formula's glyph outlines are copied into the figure's own SVG, so a saved
 * SVG or PNG draws without the network and the page theme recolours it.
 */

const SERVICE = "https://i.upmath.me/svg/";
/** One em of upmath's type in its SVG units, measured with \rule{10em}{1pt}. */
const EM = 10.939;
/** After this long a label stays plain text. */
const TIMEOUT_MS = 8000;

type Formula = {
  /** Glyph outlines and rules, in the source SVG's units. */
  body: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The baseline's y, in the same units. */
  baseline: number;
};

const formulas = new Map<string, Formula | "loading" | "failed">();

/* ── Redrawing when formulas arrive ─────────────────────────────────────── */

let revision = 0;
let notifying = false;
const listeners = new Set<() => void>();

/** Formulas that arrive close together cause one redraw. */
function changed(): void {
  if (notifying) return;
  notifying = true;
  setTimeout(() => {
    notifying = false;
    revision++;
    for (const listener of listeners) listener();
  }, 50);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes as formulas arrive; memoised figure markup should depend on it. */
export function useFormulas(): number {
  return useSyncExternalStore(subscribe, () => revision);
}

/* ── Loading ────────────────────────────────────────────────────────────── */

function load(tex: string): void {
  formulas.set(tex, "loading");
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  fetch(SERVICE + encodeURIComponent(tex), { signal: abort.signal })
    .then((response) => (response.ok ? response.text() : ""))
    .catch(() => "")
    .then((source) => {
      clearTimeout(timer);
      formulas.set(tex, (source && parse(source)) || "failed");
      changed();
    });
}

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,+\-eE]*$/;
const TRANSFORM = /^[a-z\d\s.,()+-]*$/i;

/**
 * Keeps the glyphs and rules of upmath's SVG and nothing else. The markup is
 * rebuilt from checked numbers and path data, so no attribute, script or
 * element of the response reaches the page.
 */
function parse(source: string): Formula | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.getElementsByTagName("parsererror").length)
    return null;
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
  const [x, y, width, height] = box.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  if (box.length !== 4 || !(width > 0 && height > 0) || !isFinite(x + y))
    return null;

  const glyphs = new Map<string, string>();
  for (const path of svg.querySelectorAll("defs path[id]")) {
    const d = path.getAttribute("d");
    if (d && PATH_DATA.test(d)) glyphs.set(path.id, d);
  }
  const parts: string[] = [];
  const walk = (parent: Element): void => {
    for (const el of parent.children) {
      const num = (name: string) => Number(el.getAttribute(name) ?? 0);
      switch (el.localName) {
        case "g": {
          const transform = el.getAttribute("transform") ?? "";
          if (!TRANSFORM.test(transform)) break;
          parts.push(transform ? `<g transform="${transform}">` : "<g>");
          walk(el);
          parts.push("</g>");
          break;
        }
        case "use": {
          const href =
            el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? "";
          const d = glyphs.get(href.slice(1));
          const [gx, gy] = [num("x"), num("y")];
          if (d && isFinite(gx + gy))
            parts.push(`<path transform="translate(${gx} ${gy})" d="${d}"/>`);
          break;
        }
        case "path": {
          const d = el.getAttribute("d");
          if (d && PATH_DATA.test(d)) parts.push(`<path d="${d}"/>`);
          break;
        }
        case "rect": {
          const [rx, ry, rw, rh] = [
            num("x"),
            num("y"),
            num("width"),
            num("height"),
          ];
          if (isFinite(rx + ry + rw + rh))
            parts.push(
              `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>`,
            );
          break;
        }
      }
    }
  };
  walk(svg);
  if (!parts.length) return null;

  // upmath.js reads "depth|width|height" in points from this message to sit
  // the picture on the baseline of the text around it.
  const sizes = /postMessage\((?:&quot;|")([\d|.\-eE]*)(?:&quot;|")/
    .exec(source)?.[1]
    ?.split("|")
    .map(Number);
  const depth =
    sizes && isFinite(sizes[0]!) && sizes[2]! > 0
      ? (sizes[0]! * height) / sizes[2]!
      : 0;
  return {
    body: parts.join(""),
    x,
    y,
    width,
    height,
    baseline: y + height - depth,
  };
}

/* ── Placing ────────────────────────────────────────────────────────────── */

/**
 * A formula as SVG at `size` px to the em, centred on (x, y), or with
 * `align: "start"` set on the baseline y from the left edge x, as SVG text
 * is. `halo` is the width in px of the paper-coloured outline that the label
 * group strokes under its glyphs. Null until upmath has typeset the formula,
 * and for good if it cannot: draw the label as text meanwhile.
 */
export function formulaSvg(
  tex: string,
  x: number,
  y: number,
  size: number,
  {
    align = "center",
    halo = 4,
  }: { align?: "center" | "start"; halo?: number } = {},
): string | null {
  const formula = formulas.get(tex);
  if (formula === undefined) load(tex);
  if (typeof formula !== "object") return null;
  const scale = size / EM;
  const start = align === "start";
  const left = start ? x : x - (formula.width * scale) / 2;
  const top = start
    ? y - (formula.baseline - formula.y) * scale
    : y - (formula.height * scale) / 2;
  const tx = left - formula.x * scale;
  const ty = top - formula.y * scale;
  return (
    `<g class="fig-tex" transform="matrix(${scale.toFixed(5)} 0 0 ${scale.toFixed(5)} ${tx.toFixed(2)} ${ty.toFixed(2)})" ` +
    `stroke-width="${(halo / scale).toFixed(3)}">${formula.body}</g>`
  );
}
