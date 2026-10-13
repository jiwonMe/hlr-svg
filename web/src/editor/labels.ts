/**
 * Exam-style label text in SVG: plain names, subscripts (S1 → S₁), and a
 * small math syntax — `√x` for radicals and `a/b` for stacked fractions.
 * upmath typesets labels as LaTeX; plain SVG text stands in while a formula
 * loads and for text LaTeX cannot set, such as Hangul.
 */

import { formulaSvg } from "../exam/upmath";

const SERIF = "'Bookk Myungjo', 'AppleMyungjo', 'Batang', serif";
const MATH = "'Times New Roman', Times, serif";

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Approximate advance in em; enough to centre short labels. */
function charWidth(ch: string): number {
  if (/[가-힣]/.test(ch)) return 0.95;
  if (ch === "√") return 0.62;
  if (/[0-9]/.test(ch)) return 0.52;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (ch === " ") return 0.28;
  if (ch === "°") return 0.4;
  return 0.52;
}

export function textWidthEm(text: string): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width;
}

export function isMathLabel(text: string): boolean {
  return text.includes("/") || text.includes("√");
}

/** Digits after a letter or prime are a subscript (S1, P'2); 2.45 is a number. */
const SUBSCRIPT = /^(.*[A-Za-zα-ωΑ-Ω'′])([0-9]+|[₀-₉]+)$/;

const asciiDigits = (digits: string) =>
  digits.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));

const GREEK: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "varepsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  τ: "tau",
  υ: "upsilon",
  φ: "varphi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
  Γ: "Gamma",
  Δ: "Delta",
  Θ: "Theta",
  Λ: "Lambda",
  Ξ: "Xi",
  Π: "Pi",
  Σ: "Sigma",
  Φ: "Phi",
  Ψ: "Psi",
  Ω: "Omega",
};

/** LaTeX for a run of label text, or null at a character it cannot set. */
function texRun(text: string, italic: boolean): string | null {
  let tex = "";
  let roman = "";
  const flush = () => {
    if (roman) tex += `\\mathrm{${roman}}`;
    roman = "";
  };
  for (const ch of text) {
    if (!italic && /[A-Za-z]/.test(ch)) {
      roman += ch;
      continue;
    }
    flush();
    if (/[A-Za-z0-9.,:;!?()[\]+\-=<>|']/.test(ch)) tex += ch;
    else if (GREEK[ch]) tex += `{\\${GREEK[ch]}}`;
    else if (ch === "°") tex += "^{\\circ}";
    else if (ch === "′") tex += "'";
    else if (ch === "−") tex += "-";
    else if (ch === " ") tex += "\\ ";
    else return null;
  }
  flush();
  return tex;
}

/**
 * The label as LaTeX: `S1` → `S_{1}`, `√6/2` → `\frac{\sqrt{6}}{2}`, and
 * upright letters in \mathrm. Null for text LaTeX cannot set, such as Hangul.
 */
export function labelTex(text: string, italic: boolean): string | null {
  if (!text.trim()) return null;
  if (!isMathLabel(text)) {
    const match = SUBSCRIPT.exec(text);
    const base = texRun(match ? match[1]! : text, italic);
    return base !== null && match
      ? `${base}_{${asciiDigits(match[2]!)}}`
      : base;
  }
  const radical = (part: string): string | null => {
    const at = part.indexOf("√");
    if (at < 0) return texRun(part, italic);
    const factor = texRun(part.slice(0, at), italic);
    const radicand = texRun(part.slice(at + 1), italic);
    return factor === null || radicand === null
      ? null
      : `${factor}\\sqrt{${radicand}}`;
  };
  const slash = text.indexOf("/");
  if (slash < 0) return radical(text);
  const top = radical(text.slice(0, slash));
  const bottom = radical(text.slice(slash + 1));
  return top === null || bottom === null ? null : `\\frac{${top}}{${bottom}}`;
}

/** Width and height of a label in em, for hit areas and placement. */
export function labelBoxEm(text: string): { width: number; height: number } {
  if (!isMathLabel(text)) return { width: Math.max(0.6, textWidthEm(text)), height: 1 };
  const slash = text.indexOf("/");
  if (slash < 0) return { width: textWidthEm(text) + 0.1, height: 1.15 };
  const num = text.slice(0, slash);
  const den = text.slice(slash + 1);
  return { width: Math.max(textWidthEm(num), textWidthEm(den)) + 0.3, height: 2.2 };
}

function fontAttrs(italic: boolean): string {
  return italic
    ? ` font-family="${MATH}" font-style="italic" class="fig-var"`
    : ` font-family="${SERIF}"`;
}

/** Plain text with trailing digits drawn as a subscript (S1 → S₁). */
function plainMarkup(text: string): string {
  const match = SUBSCRIPT.exec(text);
  if (!match) return escapeText(text);
  return `${escapeText(match[1]!)}<tspan baseline-shift="sub" font-size="68%">${asciiDigits(match[2]!)}</tspan>`;
}

const n = (value: number) => value.toFixed(2);

/** One line that may contain a radical, laid out from its left edge. */
function radicalLine(
  text: string,
  left: number,
  baseline: number,
  size: number,
  italic: boolean,
): string {
  const at = text.indexOf("√");
  const attrs = `${fontAttrs(italic)} font-size="${n(size)}"`;
  if (at < 0)
    return `<text x="${n(left)}" y="${n(baseline)}" text-anchor="start" dominant-baseline="alphabetic"${attrs}>${escapeText(text)}</text>`;
  const prefix = text.slice(0, at);
  const radicand = text.slice(at + 1);
  const prefixWidth = textWidthEm(prefix) * size;
  const signLeft = left + prefixWidth;
  const radLeft = signLeft + 0.6 * size;
  const radRight = radLeft + textWidthEm(radicand) * size + 0.04 * size;
  const barY = baseline - 0.8 * size;
  return (
    (prefix
      ? `<text x="${n(left)}" y="${n(baseline)}" text-anchor="start" dominant-baseline="alphabetic"${attrs}>${escapeText(prefix)}</text>`
      : "") +
    `<text x="${n(signLeft)}" y="${n(baseline)}" text-anchor="start" dominant-baseline="alphabetic" font-family="${SERIF}" font-size="${n(size)}">√</text>` +
    `<text x="${n(radLeft)}" y="${n(baseline)}" text-anchor="start" dominant-baseline="alphabetic"${attrs}>${escapeText(radicand)}</text>` +
    `<path d="M ${n(signLeft + 0.5 * size)} ${n(barY)} H ${n(radRight)}" fill="none" stroke="#0a0a0a" stroke-width="${n(Math.max(0.8, size * 0.055))}"/>`
  );
}

/**
 * SVG for a label centred on (x, y). Callers wrap it in a group that sets
 * the font size, fill and a 4px white halo.
 */
export function labelSvg(
  text: string,
  x: number,
  y: number,
  size: number,
  italic: boolean,
): string {
  const tex = labelTex(text, italic);
  const formula = tex === null ? null : formulaSvg(tex, x, y, size);
  if (formula !== null) return formula;
  if (!isMathLabel(text))
    return `<text x="${n(x)}" y="${n(y)}"${fontAttrs(italic)}>${plainMarkup(text)}</text>`;
  const slash = text.indexOf("/");
  if (slash < 0) {
    const width = textWidthEm(text) * size;
    return radicalLine(text, x - width / 2, y + 0.36 * size, size, italic);
  }
  const num = text.slice(0, slash);
  const den = text.slice(slash + 1);
  const numWidth = textWidthEm(num) * size;
  const denWidth = textWidthEm(den) * size;
  const half = Math.max(numWidth, denWidth) / 2 + 0.12 * size;
  return (
    radicalLine(num, x - numWidth / 2, y - 0.22 * size, size * 0.92, italic) +
    `<path d="M ${n(x - half)} ${n(y)} H ${n(x + half)}" fill="none" stroke="#0a0a0a" stroke-width="${n(Math.max(0.8, size * 0.06))}"/>` +
    radicalLine(den, x - denWidth / 2, y + 0.9 * size, size * 0.92, italic)
  );
}

export const LABEL_FONT = SERIF;

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Exam-style length text: 3, 3/2, √6, 3√2, √6/2, otherwise two decimals. */
export function formatLength(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  const near = (a: number, b: number) =>
    Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  if (near(value, Math.round(value))) return String(Math.round(value));
  for (const d of [2, 3, 4, 6, 1]) {
    const squared = (value * d) ** 2; // k² · n with n square-free
    const m = Math.round(squared);
    if (m < 2 || m > 40000 || !near(squared, m)) continue;
    let k = 1;
    let n = m;
    for (let f = 2; f * f <= n; f++)
      while (n % (f * f) === 0) {
        n /= f * f;
        k *= f;
      }
    const g = gcd(k, d);
    const top = n === 1 ? String(k / g) : `${k / g === 1 ? "" : k / g}√${n}`;
    return d / g === 1 ? top : `${top}/${d / g}`;
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
