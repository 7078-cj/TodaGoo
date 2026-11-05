// Posts a test summary as a comment on the pull request, or updates the one posted before, so each
// suite has a single comment that always shows the latest run. Used by backend-tests.yml and
// mobile-tests.yml through actions/github-script:
//
//   const post = require("./.github/scripts/post-test-comment.js");
//   await post({ github, context, core }, { id: "backend-tests", title: "Backend tests", file: "backend/test_log/summary.md" });
//
// `file` is the summary the test step wrote (passed / failed counts, what failed, where, the log).
// When it's missing (the job stopped before the tests ran) the comment says so and links the run.
const fs = require("fs");

const MAX_BODY = 65000; // GitHub's limit is 65 536 characters

module.exports = async ({ github, context, core }, { id, title, file, outcome }) => {
    const pr = context.payload.pull_request;
    if (!pr) {
        core.info("Not a pull request: no comment.");
        return;
    }

    const marker = `<!-- test-results:${id} -->`;
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const sha = pr.head.sha;

    let summary;
    try {
        summary = fs.readFileSync(file, "utf8").trim();
    } catch {
        summary = [
            `### ❌ ${title}: no results`,
            `The tests didn't run to the end (outcome: \`${outcome || "unknown"}\`), e.g. installing dependencies or starting up failed.`,
            `Open the [run](${runUrl}) for the error.`,
        ].join("\n");
    }

    const footer =
        `\n\n---\n<sub>Commit ${sha.slice(0, 7)} · [Run details and logs](${runUrl}) · ` +
        `updated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC</sub>`;
    let body = `${marker}\n${summary}${footer}`;
    if (body.length > MAX_BODY) {
        const cut = `\n\n…cut to fit a comment: the full summary is on the [run page](${runUrl}).`;
        body = `${marker}\n${summary.slice(0, MAX_BODY - marker.length - footer.length - cut.length - 10)}${cut}${footer}`;
    }

    const comments = await github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        per_page: 100,
    });
    const existing = comments.find((c) => c.user?.type === "Bot" && c.body?.includes(marker));

    if (existing) {
        await github.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: existing.id,
            body,
        });
        core.info(`Updated comment ${existing.html_url}`);
    } else {
        const { data } = await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pr.number,
            body,
        });
        core.info(`Posted comment ${data.html_url}`);
    }
};
