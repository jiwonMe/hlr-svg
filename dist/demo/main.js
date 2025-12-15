import { buildDemoCases } from "./cases.js";
import { renderCaseToSvgString, renderCasesToHtml } from "./renderCase.js";
function main() {
    // Handle EPIPE to avoid dying in pipes like `node ... | head`
    process.stdout.on("error", (err) => {
        if (err?.code === "EPIPE")
            process.exit(0);
    });
    const cases = buildDemoCases();
    const args = process.argv.slice(2);
    if (args.includes("--all")) {
        process.stdout.write(renderCasesToHtml(cases));
        return;
    }
    const caseArgIdx = args.findIndex((x) => x === "--case");
    const caseName = caseArgIdx >= 0 ? args[caseArgIdx + 1] : undefined;
    const selected = caseName
        ? cases.find((c) => c.name === caseName) ?? cases[0]
        : cases[cases.length - 1]; // Default: Full scene
    process.stdout.write(renderCaseToSvgString(selected));
}
main();
