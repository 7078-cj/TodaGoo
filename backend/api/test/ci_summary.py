"""
GitHub Actions summary for a test run, built from the Excel test log (see test_log.py).

    python api/test/ci_summary.py [test_log_dir]

Writes to the run's summary page ($GITHUB_STEP_SUMMARY; stdout when run locally), and to
$TEST_SUMMARY_FILE when set (the workflow posts that file as a comment on the pull request):
  - how many passed / failed / errored / skipped, and a per-module table
  - for every failed test: what caused it, the file + line, what it expected, the API / websocket
    calls it made with their responses, and the full traceback (the log)
Also prints a GitHub error annotation per failure, so it shows on the run and the PR's "Files changed".
Never fails the job itself: the test step already did.
"""
import glob
import html
import os
import re
import sys

MAX_DETAILED = 30  # failures shown in full (the summary page is limited to 1 MB)
MAX_TRACEBACK_LINES = 80
MAX_OUTPUT_CHARS = 3000

# columns of the "Test Cases" sheet
COL = {"module": 1, "cls": 2, "test": 3, "url": 4, "payload": 5, "expected": 6, "output": 7,
       "result": 8, "time": 9, "cause": 10, "traceback": 11}


def cell(row, key):
    i = COL[key]
    value = row[i] if i < len(row) else None
    return "" if value is None else str(value)


def clip_lines(text, limit):
    lines = text.splitlines()
    if len(lines) <= limit:
        return text
    return "\n".join(lines[:15] + [f"… ({len(lines) - limit} lines cut) …"] + lines[-(limit - 15):])


def clip(text, limit):
    return text if len(text) <= limit else text[: limit - 1] + "…"


def fence(text, lang=""):
    # a 4-backtick fence: tracebacks contain ~~~^^^ markers and responses can contain ```
    return f"````{lang}\n{text}\n````"


def source_link(path, line):
    """`path` line N, linked to that line on GitHub when running in Actions (the PR's head commit)."""
    repo, sha = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("HEAD_SHA") or os.environ.get("GITHUB_SHA")
    if not (repo and sha):
        return f"`{path}` line {line}"
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    return f"[`{path}` line {line}]({server}/{repo}/blob/{sha}/{path}#L{line})"


def location(tb):
    """(repo-relative path, line) of the deepest frame in a test file, for the annotation."""
    found = None
    for path, line in re.findall(r'File "([^"]+)", line (\d+)', tb or ""):
        norm = path.replace("\\", "/")
        if "/api/test/" in norm and not norm.endswith(("/test_log.py", "/ci_summary.py")):
            rel = norm[norm.rfind("backend/"):] if "backend/" in norm else norm
            found = (rel, int(line))
    return found


def annotation(text):
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def annotation_property(text):
    # property values (file=, title=) also can't contain , or :
    return annotation(text).replace(":", "%3A").replace(",", "%2C")


def main(log_dir="test_log"):
    # ✅ / ❌ even on a non-UTF-8 console (e.g. running this on Windows)
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    run_url = None
    if os.environ.get("GITHUB_RUN_ID"):
        run_url = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    lines = []

    def say(line=""):
        lines.append(line)

    try:
        write_summary(log_dir, run_url, say)
    finally:
        text = "\n".join(lines) + "\n"
        out_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if out_path:
            with open(out_path, "a", encoding="utf-8") as out:
                out.write(text)
        else:
            sys.stdout.write(text)
        comment_path = os.environ.get("TEST_SUMMARY_FILE")
        if comment_path:
            os.makedirs(os.path.dirname(comment_path) or ".", exist_ok=True)
            with open(comment_path, "w", encoding="utf-8") as f:
                f.write(text)


def write_summary(log_dir, run_url, say):
    files = sorted(f for f in glob.glob(os.path.join(log_dir, "*.xlsx")) if not os.path.basename(f).startswith("~$"))
    if not files:
        say("### ❌ Backend tests")
        say("No test log was written: the run stopped before the tests finished (e.g. install / database / import error).")
        say("Open the **Run tests** step (or the `console.log` in the **test-log** artifact) for the error.")
        return

    from openpyxl import load_workbook

    wb = load_workbook(files[-1], read_only=True)
    summary_rows = [r for r in wb["Summary"].iter_rows(values_only=True) if any(v is not None for v in r)]
    info = {r[0]: r[1] for r in summary_rows[:9]}
    module_rows = summary_rows[10:]
    cases = list(wb["Test Cases"].iter_rows(min_row=2, values_only=True))
    failures = [r for r in cases if cell(r, "result") in ("Failed", "Error")]

    total, passed = info.get("Total tests", len(cases)), info.get("Passed", 0)
    ok = not failures
    say(f"### {'✅' if ok else '❌'} Backend tests {'passed' if ok else 'failed'}")
    say(
        f"**{passed} of {total} passed** · {info.get('Failed', 0)} failed · {info.get('Error', 0)} errors · "
        f"{info.get('Skipped', 0)} skipped · {info.get('Duration', '')}"
    )
    say()
    say("| | Module | Tests | Passed | Failed | Error | Skipped |")
    say("|---|---|---|---|---|---|---|")
    for r in module_rows:
        bad = (r[3] or 0) + (r[4] or 0)
        say(f"| {'❌' if bad else '✅'} | {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]} |")

    if failures:
        say()
        say(f"#### ❌ Failed tests ({len(failures)})")
        for r in failures:
            where = location(cell(r, "traceback"))
            at = f" ({source_link(*where)})" if where else ""
            say(f"- `{cell(r, 'module')}.{cell(r, 'cls')}.{cell(r, 'test')}`: **{cell(r, 'result')}**{at}: {clip(cell(r, 'cause').splitlines()[0] if cell(r, 'cause') else '', 200)}")
        say()
        say("#### Details")
        for r in failures[:MAX_DETAILED]:
            name = f"{cell(r, 'module')}.{cell(r, 'cls')}.{cell(r, 'test')}"
            cause = cell(r, "cause") or "(no message)"
            tb = cell(r, "traceback")
            where = location(tb)
            say("<details>")
            say(f"<summary><b>{html.escape(name)}</b>: {html.escape(cell(r, 'result'))}: {html.escape(clip(cause.splitlines()[0], 160))}</summary>")
            say()
            say("**What caused it**")
            say(fence(clip(cause, MAX_OUTPUT_CHARS)))
            if where:
                say(f"**Where:** {source_link(*where)}")
            if cell(r, "expected"):
                say("**Expected**")
                say(fence(clip(cell(r, "expected"), MAX_OUTPUT_CHARS)))
            if cell(r, "url") and cell(r, "url") != "(no API call)":
                say("**Calls made**")
                say(fence(clip(cell(r, "url"), MAX_OUTPUT_CHARS)))
                if cell(r, "payload"):
                    say("**Payloads**")
                    say(fence(clip(cell(r, "payload"), MAX_OUTPUT_CHARS)))
            # the Excel "Output" ends with "FAILURE: <cause>", already shown above
            output = cell(r, "output")
            output = "" if output.startswith("FAILURE: ") else output.split("\n\nFAILURE: ")[0]
            if output:
                say("**Output (responses / checked values)**")
                say(fence(clip(output, MAX_OUTPUT_CHARS)))
            if tb:
                say("**Log (traceback)**")
                say(fence(clip_lines(tb, MAX_TRACEBACK_LINES), "python"))
            say()
            say("</details>")
            say()
        if len(failures) > MAX_DETAILED:
            say(f"…and {len(failures) - MAX_DETAILED} more: see the Excel file.")

        # annotations on the run (and on the test files in the PR)
        for r in failures:
            name = f"{cell(r, 'cls')}.{cell(r, 'test')}"
            cause = clip(cell(r, "cause") or cell(r, "result"), 1000)
            where = location(cell(r, "traceback"))
            loc = f"file={annotation_property(where[0])},line={where[1]}," if where else ""
            title = annotation_property(f"{name} ({cell(r, 'result')})")
            print(f"::error {loc}title={title}::{annotation(cause)}")
        # plain list in the step log too
        print(f"\n{len(failures)} failing test(s):")
        for r in failures:
            print(f"  {cell(r, 'result'):6} {cell(r, 'module')}.{cell(r, 'cls')}.{cell(r, 'test')}: {cell(r, 'cause').splitlines()[0] if cell(r, 'cause') else ''}")

    say()
    artifact = f"[test-log artifact]({run_url}#artifacts)" if run_url else "the **test-log** artifact"
    say(f"Everything (every test's URL, payload, expected, output) is in the Excel file in {artifact}, "
        "together with `console.log`, the full test output.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "test_log")
