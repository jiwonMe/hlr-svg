export type ProfileReport = {
  totalMs: number;
  ms: Record<string, number>;
  counts: Record<string, number>;
};

export type Profiler = {
  /** Reset all counters/timers (use this per render if you want fresh stats) */
  reset: () => void;
  /** Increment a counter (cheap) */
  inc: (name: string, by?: number) => void;
  /** Add elapsed milliseconds to a bucket */
  addMs: (name: string, ms: number) => void;
  /** Start/stop named timer (convenience wrapper around addMs) */
  begin: (name: string) => void;
  end: (name: string) => void;
  /** Snapshot report */
  report: () => ProfileReport;
  /** Time source (performance.now if available) */
  now: () => number;
};

function defaultNow(): number {
  // performance.now() is monotonic; Date.now() is OK as a fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (globalThis as any).performance;
  if (p && typeof p.now === "function") return p.now();
  return Date.now();
}

export function createProfiler(): Profiler {
  const counts = new Map<string, number>();
  const ms = new Map<string, number>();
  const open = new Map<string, number>();

  const now = () => defaultNow();

  const reset = () => {
    counts.clear();
    ms.clear();
    open.clear();
  };

  const inc = (name: string, by = 1) => {
    counts.set(name, (counts.get(name) ?? 0) + by);
  };

  const addMs = (name: string, v: number) => {
    ms.set(name, (ms.get(name) ?? 0) + v);
  };

  const begin = (name: string) => {
    open.set(name, now());
  };

  const end = (name: string) => {
    const t0 = open.get(name);
    if (t0 === undefined) return;
    open.delete(name);
    addMs(name, now() - t0);
  };

  const report = (): ProfileReport => {
    const countsObj: Record<string, number> = {};
    const msObj: Record<string, number> = {};
    for (const [k, v] of counts) countsObj[k] = v;
    for (const [k, v] of ms) msObj[k] = v;

    const totalMs = msObj["render.total"] ?? 0;
    return { totalMs, ms: msObj, counts: countsObj };
  };

  return { reset, inc, addMs, begin, end, report, now };
}

export function formatProfileReport(r: ProfileReport): string {
  const lines: string[] = [];
  lines.push(`total: ${r.totalMs.toFixed(2)}ms`);

  const msEntries = Object.entries(r.ms).sort((a, b) => b[1] - a[1]);
  if (msEntries.length) {
    lines.push("ms:");
    for (const [k, v] of msEntries) lines.push(`  ${k}: ${v.toFixed(2)}`);
  }

  const cEntries = Object.entries(r.counts).sort((a, b) => b[1] - a[1]);
  if (cEntries.length) {
    lines.push("counts:");
    for (const [k, v] of cEntries) lines.push(`  ${k}: ${v}`);
  }
  return lines.join("\n");
}


