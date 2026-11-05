// Jest reporter for GitHub Actions (npm run test:ci). Same layout as the backend's api/test/ci_summary.py:
//   - how many passed / failed, per test file
//   - every failed test: what caused it, where (file + line, linked on GitHub), and the log
// Written to the run's summary page ($GITHUB_STEP_SUMMARY) and to $TEST_SUMMARY_FILE (the workflow
// posts that file as a comment on the pull request). Also marks each failure on its line
// (an ::error annotation). Locally, with neither variable set, it does nothing.
const fs = require("fs");
const path = require("path");

const MAX_DETAILED = 30; // failures shown in full (a PR comment is limited to 65 536 characters)
const MAX_TRACE_LINES = 60;

const stripAnsi = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, "");
const escapeData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProp = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// "Error: expect(...).toBe(...) · Expected: 3 · Received: 2" for one-line places
const oneLine = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean).join(" · ");
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const clipLines = (text, limit) => {
    const lines = text.split("\n");
    if (lines.length <= limit) return text;
    return [...lines.slice(0, limit - 10), `… (${lines.length - limit} lines cut) …`, ...lines.slice(-10)].join("\n");
};
// a 4-backtick fence: Jest's messages can contain ```
const fence = (text) => "````\n" + text + "\n````";

// `file` line N, linked to that line of the PR's head commit when running in Actions
function sourceLink(file, line) {
    const { GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: server = "https://github.com" } = process.env;
    const sha = process.env.HEAD_SHA || process.env.GITHUB_SHA;
    if (!repo || !sha) return `\`${file}\` line ${line}`;
    return `[\`${file}\` line ${line}](${server}/${repo}/blob/${sha}/${file}#L${line})`;
}

class CiSummaryReporter {
    constructor(globalConfig) {
        this.rootDir = globalConfig.rootDir;
    }

    onRunComplete(_contexts, results) {
        const summaryFile = process.env.GITHUB_STEP_SUMMARY;
        const commentFile = process.env.TEST_SUMMARY_FILE;
        if (!summaryFile && !commentFile) return;

        const repoRoot = path.resolve(this.rootDir, "..");
        const rel = (file) => path.relative(repoRoot, file).split(path.sep).join("/");
        const seconds = Math.round((Date.now() - results.startTime) / 1000);
        // from the counts: results.success is still false here (Jest sets it after the reporters run)
        const ok =
            results.numFailedTests === 0 &&
            results.numRuntimeErrorTestSuites === 0 &&
            results.numFailedTestSuites === 0 &&
            results.numTotalTests > 0;

        // the line in the test file where it failed: the test file's own stack frame, else the
        // first frame in any file under __tests__ (e.g. a helper)
        const lineIn = (trace, testFile) => {
            const own = trace.match(new RegExp(`${path.basename(testFile).replace(/\./g, "\\.")}:(\\d+):\\d+`));
            if (own) return { file: rel(testFile), line: Number(own[1]) };
            const helper = trace.match(/\(?((?:[\w.-]+[\\/])*__tests__[\\/][\w./\\-]+\.js):(\d+):\d+/);
            if (helper) return { file: rel(path.resolve(this.rootDir, helper[1])), line: Number(helper[2]) };
            return { file: rel(testFile), line: 1 };
        };

        // Jest's message: the error with Expected / Received (before the first "at ..." line), and a log
        // without Jest's own frames, with paths relative to the repo
        const toRepoPaths = (text) => text.split(repoRoot + path.sep).join("").split(path.sep).join("/");
        const causeOf = (trace) => {
            const head = trace.split("\n").filter((l, i, all) => !/^\s+at /.test(l) && all.slice(0, i).every((p) => !/^\s+at /.test(p)));
            return head.join("\n").trim() || "failed";
        };
        const tidy = (trace) =>
            toRepoPaths(trace.split("\n").filter((l) => !(/^\s+at /.test(l) && /node_modules|node:internal|<anonymous>/.test(l))).join("\n"));

        const failures = [];
        for (const suite of results.testResults) {
            if (suite.testExecError) {
                const message = stripAnsi(suite.testExecError.message || suite.failureMessage || "failed to run");
                failures.push({
                    name: `${rel(suite.testFilePath)} (test file failed to run)`,
                    kind: "Error",
                    cause: toRepoPaths(message.trim()) || "failed to run",
                    trace: tidy(stripAnsi(suite.failureMessage || message)),
                    ...lineIn(stripAnsi(suite.failureMessage || ""), suite.testFilePath),
                });
            }
            for (const test of suite.testResults.filter((t) => t.status === "failed")) {
                const trace = stripAnsi(test.failureMessages.join("\n\n"));
                failures.push({
                    name: `${rel(suite.testFilePath)} › ${test.fullName || test.title}`,
                    kind: "Failed",
                    cause: toRepoPaths(causeOf(trace)),
                    trace: tidy(trace),
                    ...lineIn(trace, suite.testFilePath),
                });
            }
        }

        const lines = [
            `### ${ok ? "✅ Mobile tests passed" : "❌ Mobile tests failed"}`,
            `**${results.numPassedTests} of ${results.numTotalTests} passed** · ${results.numFailedTests} failed · ` +
                `${results.numRuntimeErrorTestSuites} test files failed to run · ${results.numPendingTests} skipped · ${seconds} s`,
            "",
            "| | Test file | Tests | Passed | Failed |",
            "|---|---|---|---|---|",
        ];
        for (const suite of results.testResults) {
            const broken = !!suite.testExecError;
            const total = suite.numPassingTests + suite.numFailingTests + suite.numPendingTests;
            lines.push(
                `| ${suite.numFailingTests || broken ? "❌" : "✅"} | \`${rel(suite.testFilePath)}\` | ${total} | ` +
                    `${suite.numPassingTests} | ${broken ? "failed to run" : suite.numFailingTests} |`
            );
        }

        if (failures.length) {
            lines.push("", `#### ❌ Failed tests (${failures.length})`);
            for (const f of failures) {
                lines.push(`- \`${f.name}\` (${sourceLink(f.file, f.line)}): ${clip(oneLine(f.cause), 200)}`);
            }
            lines.push("", "#### Details");
            for (const f of failures.slice(0, MAX_DETAILED)) {
                lines.push(
                    "<details>",
                    `<summary><b>${escapeHtml(f.name)}</b>: ${f.kind}: ${escapeHtml(clip(oneLine(f.cause), 160))}</summary>`,
                    "",
                    "**What caused it**",
                    fence(clip(f.cause, 3000)),
                    `**Where:** ${sourceLink(f.file, f.line)}`,
                    "",
                    "**Log**",
                    fence(clipLines(f.trace, MAX_TRACE_LINES)),
                    "",
                    "</details>",
                    ""
                );
            }
            if (failures.length > MAX_DETAILED) {
                lines.push(`…and ${failures.length - MAX_DETAILED} more: see console.log in the mobile-test-log artifact.`);
            }

            // marks each failure on its line (the run page, and "Files changed" in the PR)
            if (process.env.GITHUB_ACTIONS) {
                for (const f of failures) {
                    process.stdout.write(
                        `::error file=${escapeProp(f.file)},line=${f.line},title=${escapeProp(f.name)}::${escapeData(clip(f.cause, 1000))}\n`
                    );
                }
            }
        }

        const text = lines.join("\n") + "\n";
        if (summaryFile) fs.appendFileSync(summaryFile, text);
        if (commentFile) {
            fs.mkdirSync(path.dirname(path.resolve(commentFile)), { recursive: true });
            fs.writeFileSync(commentFile, text);
        }
    }
}

module.exports = CiSummaryReporter;
