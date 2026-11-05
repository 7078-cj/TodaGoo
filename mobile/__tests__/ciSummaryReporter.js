// Jest reporter for GitHub Actions (npm run test:ci): writes the run summary page and marks each
// failed test on its line. Same layout as the backend's api/test/ci_summary.py.
// Outside GitHub Actions (no GITHUB_STEP_SUMMARY) it does nothing.
const fs = require("fs");
const path = require("path");

const stripAnsi = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, "");
const escapeData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProp = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

class CiSummaryReporter {
    constructor(globalConfig) {
        this.rootDir = globalConfig.rootDir;
    }

    onRunComplete(_contexts, results) {
        const summaryFile = process.env.GITHUB_STEP_SUMMARY;
        if (!summaryFile) return;

        const repoRoot = path.resolve(this.rootDir, "..");
        const rel = (file) => path.relative(repoRoot, file).split(path.sep).join("/");
        const seconds = Math.round((Date.now() - results.startTime) / 1000);
        const failedSuites = results.testResults.filter((s) => s.testExecError || s.failureMessage);
        const ok = results.success !== false && results.numFailedTests === 0 && results.numRuntimeErrorTestSuites === 0;

        const lines = [];
        lines.push(
            `## ${ok ? "✅ Mobile tests passed" : "❌ Mobile tests failed"} · ` +
                `**${results.numPassedTests} of ${results.numTotalTests} passed** · ` +
                `${results.numFailedTests} failed · ${results.numRuntimeErrorTestSuites} suites errored · ` +
                `${results.numPendingTests} skipped · ${seconds} s`,
            "",
            "| | Test file | Passed | Failed |",
            "| --- | --- | --- | --- |"
        );
        for (const suite of results.testResults) {
            const passed = suite.numPassingTests;
            const failed = suite.numFailingTests;
            const broken = !!suite.testExecError;
            lines.push(`| ${failed || broken ? "❌" : "✅"} | \`${rel(suite.testFilePath)}\` | ${passed} | ${broken ? "suite failed to run" : failed} |`);
        }

        if (failedSuites.length) {
            lines.push("", "### What failed", "");
            const details = [];
            for (const suite of failedSuites) {
                const file = rel(suite.testFilePath);
                if (suite.testExecError) {
                    const message = stripAnsi(suite.testExecError.message || suite.failureMessage || "");
                    lines.push(`- \`${file}\`: test file failed to run: ${message.split("\n")[0]}`);
                    details.push({ title: `${file} (failed to run)`, file, line: 1, message, trace: stripAnsi(suite.failureMessage || message) });
                }
                for (const test of suite.testResults.filter((t) => t.status === "failed")) {
                    const trace = stripAnsi(test.failureMessages.join("\n\n"));
                    const cause = trace.split("\n").find((l) => l.trim()) || "failed";
                    const name = test.fullName || test.title;
                    lines.push(`- \`${file}\` › ${name}: ${cause.trim()}`);
                    const at = trace.match(new RegExp(`${path.basename(suite.testFilePath).replace(/\./g, "\\.")}:(\\d+):\\d+`));
                    details.push({ title: `${file} › ${name}`, file, line: at ? Number(at[1]) : 1, message: cause.trim(), trace });
                }
            }
            lines.push("");
            for (const d of details) {
                lines.push(
                    "<details>",
                    `<summary>${d.title.replace(/</g, "&lt;")}</summary>`,
                    "",
                    `**What caused it:** \`${d.message.replace(/`/g, "'")}\``,
                    "",
                    `**Where:** \`${d.file}:${d.line}\``,
                    "",
                    "**Log:**",
                    "",
                    "```",
                    d.trace,
                    "```",
                    "</details>",
                    ""
                );
                // marks the failed test on its line in the PR's "Files changed" view
                process.stdout.write(
                    `::error file=${escapeProp(d.file)},line=${d.line},title=${escapeProp(d.title)}::${escapeData(d.message)}\n`
                );
            }
        }

        fs.appendFileSync(summaryFile, lines.join("\n") + "\n");
    }
}

module.exports = CiSummaryReporter;
