import React, { useLayoutEffect, useRef } from "react";

declare global {
  interface Window {
    /** upmath.js, loaded by index.html. */
    S2Latex?: { processTree(element: Element): void };
  }
}

/* ── Typesetting: upmath.js turns $$…$$ into pictures ──────────────────── */

/**
 * Text with LaTeX between `$$` delimiters. upmath.js swaps each formula for
 * an SVG picture from i.upmath.me; a screen reader hears it read out.
 */
export function Tex({ text }: { text: string }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  // React leaves the span empty; what goes inside belongs to upmath.js.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = text;
    window.S2Latex?.processTree(el);
    for (const img of el.querySelectorAll("img")) {
      const reading = document.createElement("span");
      reading.className = "sr-only";
      reading.textContent = speak(img.alt);
      img.alt = "";
      img.after(reading);
    }
  }, [text]);
  return <span ref={ref} className="tex" />;
}

/**
 * tex`평면 $$\alpha$$` is `<Tex text="평면 $$\alpha$$" />` with backslashes
 * kept as typed. A formula must not open with `{`: `$${` starts a
 * substitution.
 */
export function tex(
  strings: TemplateStringsArray,
  ...values: unknown[]
): React.ReactElement {
  return <Tex text={String.raw(strings, ...values)} />;
}

/* ── Reading formulas aloud ─────────────────────────────────────────────── */

const WORDS: Record<string, string> = {
  alpha: "알파",
  beta: "베타",
  theta: "세타",
  pi: "파이",
  angle: "각",
  triangle: "삼각형",
  perp: "수직",
  cos: "코사인",
  sin: "사인",
  tan: "탄젠트",
};
/** Commands that only change how a formula looks. */
const SILENT = new Set(["displaystyle", "left", "right", "rm"]);

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * A formula in the words of the exam's spoken answers:
 * \frac{\sqrt6}{2} → "2분의 루트 6", \overrightarrow{OP} → "벡터 OP".
 */
export function speak(formula: string): string {
  let at = 0;
  // One argument: a {group}, a command or a single character.
  const argument = (): string => {
    while (formula[at] === " ") at++;
    return squash(next());
  };
  const next = (): string => {
    const ch = formula[at++];
    if (ch === undefined) return "";
    if (ch === "{") {
      let group = "";
      while (at < formula.length && formula[at] !== "}") group += next();
      at++;
      return group;
    }
    if (ch === "_") return ` ${argument()} `;
    if (ch === "^") {
      const power = argument();
      return power === "도" ? "도" : `의 ${power}제곱 `;
    }
    if (ch === "-") return " − ";
    if (ch === "~") return " ";
    if (ch !== "\\") return ch;
    const name = /^(?:[A-Za-z]+|.)/.exec(formula.slice(at))?.[0] ?? "";
    at += name.length;
    switch (name) {
      case "frac": {
        const top = argument();
        return ` ${argument()}분의 ${top} `;
      }
      case "sqrt":
        return ` 루트 ${argument()} `;
      case "overrightarrow":
      case "vec":
        return ` 벡터 ${argument()} `;
      case "overline":
        return ` 선분 ${argument()} `;
      case "mathrm":
      case "text":
        return argument();
      case "circ":
        return "도";
    }
    if (SILENT.has(name)) return "";
    if (!/[A-Za-z]/.test(name)) return /[,;:! ]/.test(name) ? " " : name;
    return ` ${WORDS[name] ?? name} `;
  };
  let spoken = "";
  while (at < formula.length) spoken += next();
  return squash(spoken);
}
