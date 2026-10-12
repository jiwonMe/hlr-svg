import React, { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { INSTALL_COMMAND, siteText, type SiteLocale } from "./siteText";

// Enough TypeScript tokenizing for black-and-white samples: comments,
// strings, keywords and numbers. Everything else stays plain ink.
const TOKEN =
  /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|let|new|await|async|function|return|type|as|of|for|if|else|true|false|null|undefined)\b|(\b\d+(?:\.\d+)?\b)/g;
const CLASSES = ["tok-c", "tok-s", "tok-k", "tok-n"] as const;

export function highlightTs(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const group = match.slice(1).findIndex((value) => value !== undefined);
    out.push(
      <span key={index} className={CLASSES[group]}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

type CopyState = "idle" | "copied" | "failed";

function useCopy(text: string): [CopyState, () => Promise<void>] {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);
  return [
    state,
    async () => {
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
      } catch {
        setState("failed");
      }
    },
  ];
}

export function CodeWindow({
  title,
  code,
  locale = "ko-kr",
  className = "",
}: {
  title: string;
  code: string;
  locale?: SiteLocale;
  className?: string;
}): React.ReactElement {
  const [state, copy] = useCopy(code);
  const label =
    locale === "ko-kr"
      ? state === "copied"
        ? "복사함"
        : "복사"
      : state === "copied"
        ? "Copied"
        : "Copy";
  return (
    <figure className={`code-window ${className}`}>
      <figcaption className="code-window-bar">
        <span className="code-window-title">{title}</span>
        <button
          type="button"
          className="code-window-copy"
          onClick={() => void copy()}
        >
          {state === "copied" ? (
            <Check aria-hidden="true" size={13} strokeWidth={2} />
          ) : (
            <Copy aria-hidden="true" size={13} strokeWidth={1.8} />
          )}
          <span>{label}</span>
        </button>
      </figcaption>
      <pre className="code-window-body">
        <code>{highlightTs(code)}</code>
      </pre>
    </figure>
  );
}

export function InstallCommand({
  locale = "ko-kr",
  className = "",
}: {
  locale?: SiteLocale;
  className?: string;
}): React.ReactElement {
  const t = siteText(locale);
  const [state, copy] = useCopy(INSTALL_COMMAND);
  return (
    <span className={`install ${className}`}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t.copy(INSTALL_COMMAND)}
      >
        <span className="install-prompt" aria-hidden="true">
          $
        </span>
        <code>{INSTALL_COMMAND}</code>
        {state === "copied" ? (
          <Check aria-hidden="true" size={15} strokeWidth={2} />
        ) : (
          <Copy aria-hidden="true" size={14} strokeWidth={1.8} />
        )}
      </button>
      <span className="install-status" role="status">
        {state === "copied" ? t.copied : state === "failed" ? t.copyFailed : ""}
      </span>
    </span>
  );
}
