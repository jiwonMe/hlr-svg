import { buildDemoCases } from "./cases.js";
import { renderCaseToSvgString, renderCasesToHtml } from "./renderCase.js";

function main(): void {
  // `node ... | head` 같은 파이프에서 EPIPE로 죽지 않도록 처리
  process.stdout.on("error", (err: any) => {
    if (err?.code === "EPIPE") process.exit(0);
  });

  const cases = buildDemoCases();
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    process.stdout.write(renderCasesToHtml(cases));
    return;
  }

  const caseArgIdx = args.findIndex((x) => x === "--case");
  const caseName = caseArgIdx >= 0 ? args[caseArgIdx + 1] : undefined;
  const selected =
    caseName
      ? cases.find((c) => c.name === caseName) ?? cases[0]!
      : cases[cases.length - 1]!; // 기본: Full scene

  process.stdout.write(renderCaseToSvgString(selected));
}

main();


