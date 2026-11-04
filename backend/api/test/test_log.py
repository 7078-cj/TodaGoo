"""
Test log: records what every test did and writes it to an Excel file in backend/test_log/.

Used by the test runner (backend/test_runner.py), so it runs on every `manage.py test`:

    python manage.py test                                  -> test_log/test_log_2026-11-04_19-40-12_all.xlsx
    python manage.py test api.test.NotificationsTest       -> ..._NotificationsTest.xlsx
    python manage.py test --no-test-log                    -> no file

For each test it records:
  URL       every API call (method + path) and websocket (connect / send / receive) it made
  Payload   the data sent with each call
  Expected  what the test checks: the expected side of each assert (assertEqual(actual, EXPECTED), ...)
            plus the test's docstring, if it has one
  Output    the status code + response body of each call (and what the websocket sent back);
            for a failed test, also the failure message
  Result    Passed / Failed / Error / Skipped

Sheets: "Summary" (totals), "Test Cases" (one row per test), "Requests" (one row per call).
"""
import functools

# unittest leaves this module's frames (the assert wrappers) out of failure tracebacks,
# so a failure points at the test's own line, as without the test log
__unittest = True
import json
import re
import time
import traceback
import unittest
from datetime import datetime
from pathlib import Path

MAX_CELL = 32000  # Excel's limit is 32767 characters per cell
MAX_BODY = 1500  # per response body / payload in the Test Cases sheet
MAX_EXPECTED_ITEMS = 25

HTTP_METHODS = ("get", "post", "put", "patch", "delete", "head", "options")

# assert method -> which argument is the actual value (shown in "Output" next to the call results)
ACTUAL_ARG = {
    "assertIn": 1, "assertNotIn": 1,
    "assertRaises": None, "assertRaisesMessage": None,
}

# assert method -> how its expected side reads in the "Expected" column
ASSERT_FORMATS = {
    "assertEqual": lambda a: f"= {short(a[1])}",
    "assertNotEqual": lambda a: f"≠ {short(a[1])}",
    "assertIn": lambda a: f"contains {short(a[0])}",
    "assertNotIn": lambda a: f"doesn't contain {short(a[0])}",
    "assertTrue": lambda a: "true",
    "assertFalse": lambda a: "false",
    "assertIsNone": lambda a: "None",
    "assertIsNotNone": lambda a: "not None",
    "assertGreater": lambda a: f"> {short(a[1])}",
    "assertGreaterEqual": lambda a: f">= {short(a[1])}",
    "assertLess": lambda a: f"< {short(a[1])}",
    "assertLessEqual": lambda a: f"<= {short(a[1])}",
    "assertAlmostEqual": lambda a: f"≈ {short(a[1])}",
    "assertIsInstance": lambda a: f"is a {getattr(a[1], '__name__', a[1])}",
    "assertCountEqual": lambda a: f"same items as {short(a[1])}",
    "assertDictEqual": lambda a: f"= {short(a[1])}",
    "assertListEqual": lambda a: f"= {short(a[1])}",
    "assertSetEqual": lambda a: f"= {short(a[1])}",
    "assertRaises": lambda a: f"raises {getattr(a[0], '__name__', a[0])}",
    "assertRaisesMessage": lambda a: f"raises {getattr(a[0], '__name__', a[0])}: {short(a[1])}",
}


def short(value, limit=200):
    text = value if isinstance(value, str) else to_text(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def to_text(value, limit=None):
    """Readable text for a payload / response body (JSON when possible)."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            return f"<{len(value)} bytes>"
    if not isinstance(value, str):
        try:
            value = json.dumps(value, default=_json_default, ensure_ascii=False)
        except (TypeError, ValueError):
            value = repr(value)
    if limit and len(value) > limit:
        value = value[: limit - 1] + "…"
    return value


def _json_default(obj):
    name = getattr(obj, "name", None)
    if name and hasattr(obj, "read"):  # uploaded file
        return f"<file {name}>"
    return str(obj)


class Call:
    """One API call or websocket event made by a test."""

    def __init__(self, kind, url, payload="", status="", output=""):
        self.kind, self.url, self.payload, self.status, self.output = kind, url, payload, status, output


class TestRecord:
    def __init__(self, test):
        self.test = test
        self.test_id = test.id()
        parts = self.test_id.split(".")
        # api.test.NotificationsTest.NotificationDeleteTests.test_delete_one
        self.module = parts[-3] if len(parts) >= 3 else ""
        self.cls = parts[-2] if len(parts) >= 2 else ""
        self.name = parts[-1]
        doc = (test.shortDescription() or "") if hasattr(test, "shortDescription") else ""
        self.description = doc
        self.calls = []
        self.expected = []
        self.actual = []
        self.result = "Passed"
        self.error = ""  # the cause: exception type + message
        self.traceback = ""  # the full log of the failure
        self.started = time.perf_counter()
        self.duration = 0.0


class TestLogRecorder:
    """Patches the test clients, websocket communicator and assert methods while tests run."""

    def __init__(self):
        self.records = []
        self.current = None
        self._depth = 0  # nested client / assert calls are recorded once (the outermost)
        self._assert_depth = 0
        self._patches = []
        self.started_at = datetime.now()
        self.finished_at = None

    # ---- test lifecycle (called by the result class) ----
    def start(self, test):
        self.current = TestRecord(test)
        self.records.append(self.current)

    def finish(self, test):
        record = self._record_for(test)
        if record:
            record.duration = time.perf_counter() - record.started
        self.current = None

    def set_result(self, test, result, err=None, tb=None):
        record = self._record_for(test) or self._standalone(test)
        # a failed subTest / error after a pass wins; Skipped never overrides a failure
        if result in ("Failed", "Error") or record.result == "Passed":
            record.result = result
        if err:
            message = err if isinstance(err, str) else "".join(traceback.format_exception_only(err[0], err[1])).strip()
            record.error = (record.error + "\n" if record.error else "") + message
        if tb:
            record.traceback = (record.traceback + "\n" if record.traceback else "") + tb.strip()

    def _record_for(self, test):
        if self.current and self.current.test_id == test.id():
            return self.current
        for record in reversed(self.records):
            if record.test_id == test.id():
                return record
        return None

    def _standalone(self, test):
        # setUpClass errors etc. arrive without startTest
        record = TestRecord(test)
        self.records.append(record)
        return record

    # ---- patching ----
    def install(self):
        from django.test import Client
        from rest_framework.test import APIClient

        for cls in (APIClient, Client):
            for method in HTTP_METHODS:
                if method in cls.__dict__:
                    self._patch(cls, method, self._wrap_http(getattr(cls, method), method.upper()))

        try:
            from channels.testing import WebsocketCommunicator

            self._patch(WebsocketCommunicator, "connect", self._wrap_ws_connect(WebsocketCommunicator.connect))
            self._patch(WebsocketCommunicator, "send_to", self._wrap_ws_send(WebsocketCommunicator.send_to))
            self._patch(WebsocketCommunicator, "send_json_to", self._wrap_ws_send(WebsocketCommunicator.send_json_to, json_=True))
            self._patch(WebsocketCommunicator, "receive_from", self._wrap_ws_receive(WebsocketCommunicator.receive_from))
            self._patch(WebsocketCommunicator, "receive_json_from", self._wrap_ws_receive(WebsocketCommunicator.receive_json_from))
            self._patch(WebsocketCommunicator, "receive_nothing", self._wrap_ws_nothing(WebsocketCommunicator.receive_nothing))
            self._patch(WebsocketCommunicator, "disconnect", self._wrap_ws_disconnect(WebsocketCommunicator.disconnect))
        except ImportError:
            pass

        for name in ASSERT_FORMATS:
            original = getattr(unittest.TestCase, name, None)
            if original is None:
                from django.test import SimpleTestCase
                original = getattr(SimpleTestCase, name, None)
                owner = SimpleTestCase
            else:
                owner = unittest.TestCase
            if original is not None:
                self._patch(owner, name, self._wrap_assert(original, name))

    def uninstall(self):
        for owner, name, original in reversed(self._patches):
            setattr(owner, name, original)
        self._patches.clear()

    def _patch(self, owner, name, wrapper):
        self._patches.append((owner, name, owner.__dict__[name] if name in owner.__dict__ else getattr(owner, name)))
        setattr(owner, name, wrapper)

    def _add_call(self, call):
        if self.current is not None:
            self.current.calls.append(call)

    def _wrap_http(self, original, verb):
        recorder = self

        @functools.wraps(original)
        def wrapper(client, path, data=None, *args, **kwargs):
            if recorder._depth:
                return original(client, path, data, *args, **kwargs)
            recorder._depth += 1
            try:
                response = original(client, path, data, *args, **kwargs)
            except Exception as exc:
                recorder._add_call(Call("HTTP", f"{verb} {path}", to_text(data), "exception", repr(exc)))
                raise
            finally:
                recorder._depth -= 1
            body = getattr(response, "data", None)
            if body is None:
                body = getattr(response, "content", b"")
            recorder._add_call(Call("HTTP", f"{verb} {path}", to_text(data), response.status_code, to_text(body)))
            return response

        return wrapper

    def _wrap_ws_connect(self, original):
        recorder = self

        @functools.wraps(original)
        async def wrapper(communicator, *args, **kwargs):
            result = await original(communicator, *args, **kwargs)
            connected, code = result if isinstance(result, tuple) else (result, None)
            status = "connected" if connected else f"rejected ({code})"
            recorder._add_call(Call("WS", f"WS CONNECT {communicator.scope.get('path', '')}", "", status, ""))
            return result

        return wrapper

    def _wrap_ws_send(self, original, json_=False):
        recorder = self

        @functools.wraps(original)
        async def wrapper(communicator, *args, **kwargs):
            payload = args[0] if args else (kwargs.get("data") if json_ else kwargs.get("text_data") or kwargs.get("bytes_data"))
            recorder._add_call(Call("WS", f"WS SEND {communicator.scope.get('path', '')}", to_text(payload), "", ""))
            return await original(communicator, *args, **kwargs)

        return wrapper

    def _wrap_ws_receive(self, original):
        recorder = self

        @functools.wraps(original)
        async def wrapper(communicator, *args, **kwargs):
            try:
                message = await original(communicator, *args, **kwargs)
            except Exception as exc:
                recorder._add_call(Call("WS", f"WS RECEIVE {communicator.scope.get('path', '')}", "", "nothing", type(exc).__name__))
                raise
            recorder._add_call(Call("WS", f"WS RECEIVE {communicator.scope.get('path', '')}", "", "received", to_text(message)))
            return message

        return wrapper

    def _wrap_ws_nothing(self, original):
        recorder = self

        @functools.wraps(original)
        async def wrapper(communicator, *args, **kwargs):
            nothing = await original(communicator, *args, **kwargs)
            recorder._add_call(Call(
                "WS", f"WS EXPECT NOTHING {communicator.scope.get('path', '')}", "",
                "nothing received" if nothing else "a message arrived", "",
            ))
            return nothing

        return wrapper

    def _wrap_ws_disconnect(self, original):
        recorder = self

        @functools.wraps(original)
        async def wrapper(communicator, *args, **kwargs):
            result = await original(communicator, *args, **kwargs)
            recorder._add_call(Call("WS", f"WS DISCONNECT {communicator.scope.get('path', '')}", "", "closed", ""))
            return result

        return wrapper

    def _wrap_assert(self, original, name):
        recorder = self
        fmt = ASSERT_FORMATS[name]

        @functools.wraps(original)
        def wrapper(test, *args, **kwargs):
            outer = recorder._assert_depth == 0
            if outer and recorder.current is not None and len(recorder.current.expected) < MAX_EXPECTED_ITEMS:
                try:
                    text = fmt(args) if args or name in ("assertTrue", "assertFalse") else name
                except Exception:
                    text = name
                recorder.current.expected.append(text)
                index = ACTUAL_ARG.get(name, 0)
                if index is not None and len(args) > index:
                    recorder.current.actual.append(short(args[index]))
            recorder._assert_depth += 1
            try:
                return original(test, *args, **kwargs)
            finally:
                recorder._assert_depth -= 1

        return wrapper


def make_result_class(base, recorder):
    """The runner's result class, also reporting every outcome to the recorder."""

    class TestLogResult(base):
        def startTest(self, test):
            recorder.start(test)
            super().startTest(test)

        def stopTest(self, test):
            super().stopTest(test)
            recorder.finish(test)

        def addSuccess(self, test):
            super().addSuccess(test)

        def _traceback(self, err, test):
            # unittest's own formatting: the trimmed traceback printed in the console
            try:
                return self._exc_info_to_string(err, test)
            except Exception:
                return "".join(traceback.format_exception(*err))

        def addFailure(self, test, err):
            super().addFailure(test, err)
            recorder.set_result(test, "Failed", err, self._traceback(err, test))

        def addError(self, test, err):
            super().addError(test, err)
            recorder.set_result(test, "Error", err, self._traceback(err, test))

        def addSkip(self, test, reason):
            super().addSkip(test, reason)
            recorder.set_result(test, "Skipped", f"Skipped: {reason}")

        def addExpectedFailure(self, test, err):
            super().addExpectedFailure(test, err)

        def addUnexpectedSuccess(self, test):
            super().addUnexpectedSuccess(test)
            recorder.set_result(test, "Failed", "Unexpected success")

        def addSubTest(self, test, subtest, err):
            super().addSubTest(test, subtest, err)
            if err is not None:
                failed = issubclass(err[0], test.failureException)
                recorder.set_result(test, "Failed" if failed else "Error", err, self._traceback(err, test))

    return TestLogResult


# ---------------------------------------------------------------------------
# Excel output
# ---------------------------------------------------------------------------
def scope_name(test_labels):
    """'all' for the whole suite, otherwise the modules / tests that were run."""
    labels = [label for label in (test_labels or []) if label]
    if not labels or all(label.rstrip(".") in ("api", "api.test", ".") for label in labels):
        return "all"
    names = [re.sub(r"^api\.test\.", "", label) for label in labels]
    if len(names) > 1:
        # several labels: just their modules (NotificationsTest+ChatAndReportsTest), or a count
        modules = list(dict.fromkeys(n.split(".")[0] for n in names))
        name = "+".join(modules) if len(modules) <= 3 else f"{len(modules)}-modules"
    else:
        name = names[0]  # one module / class / test, e.g. NotificationsTest.NotificationDeleteTests
    name = re.sub(r"[^A-Za-z0-9_.+-]", "_", name)
    return name[:100]


def _cell(text):
    text = "" if text is None else str(text)
    # characters Excel refuses (control chars)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text if len(text) <= MAX_CELL else text[: MAX_CELL - 1] + "…"


def _numbered(lines):
    if len(lines) == 1:
        return lines[0]
    return "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))


def write_excel(recorder, test_labels, out_dir):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scope = scope_name(test_labels)
    stamp = recorder.started_at.strftime("%Y-%m-%d_%H-%M-%S")
    path = out_dir / f"test_log_{stamp}_{scope}.xlsx"

    records = recorder.records
    counts = {key: sum(1 for r in records if r.result == key) for key in ("Passed", "Failed", "Error", "Skipped")}

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="DF6D26")
    thin = Side(style="thin", color="D1D5DB")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical="top")
    result_fills = {
        "Passed": PatternFill("solid", fgColor="DCFCE7"),
        "Failed": PatternFill("solid", fgColor="FEE2E2"),
        "Error": PatternFill("solid", fgColor="FECACA"),
        "Skipped": PatternFill("solid", fgColor="FEF9C3"),
    }

    def table(ws, headers, rows, widths, result_col=None):
        ws.append(headers)
        for col, _ in enumerate(headers, 1):
            c = ws.cell(row=1, column=col)
            c.font, c.fill, c.border = header_font, header_fill, border
            c.alignment = Alignment(vertical="center", wrap_text=True)
        for row in rows:
            ws.append([_cell(v) if isinstance(v, str) else v for v in row])
        for r in range(2, ws.max_row + 1):
            for col in range(1, len(headers) + 1):
                c = ws.cell(row=r, column=col)
                c.alignment, c.border = wrap, border
            if result_col:
                c = ws.cell(row=r, column=result_col)
                c.fill = result_fills.get(c.value, PatternFill())
                c.font = Font(bold=True)
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    wb = Workbook()

    # ---- Summary ----
    ws = wb.active
    ws.title = "Summary"
    duration = ((recorder.finished_at or datetime.now()) - recorder.started_at).total_seconds()
    summary = [
        ("Run", "All tests" if scope == "all" else "Specific: " + ", ".join(test_labels)),
        ("Started", recorder.started_at.strftime("%Y-%m-%d %H:%M:%S")),
        ("Duration", f"{duration:.1f} s"),
        ("Total tests", len(records)),
        ("Passed", counts["Passed"]),
        ("Failed", counts["Failed"]),
        ("Error", counts["Error"]),
        ("Skipped", counts["Skipped"]),
        ("Overall", "PASSED" if not (counts["Failed"] or counts["Error"]) else "FAILED"),
    ]
    for key, value in summary:
        ws.append([key, value])
    for r in range(1, ws.max_row + 1):
        ws.cell(row=r, column=1).font = Font(bold=True)
    overall = ws.cell(row=len(summary), column=2)
    overall.font = Font(bold=True, color="FFFFFF")
    overall.fill = PatternFill("solid", fgColor="16A34A" if overall.value == "PASSED" else "DC2626")
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 70

    # per-module breakdown
    ws.append([])
    start = ws.max_row + 1
    ws.append(["Module", "Tests", "Passed", "Failed", "Error", "Skipped"])
    for col in range(1, 7):
        c = ws.cell(row=start, column=col)
        c.font, c.fill = header_font, header_fill
    modules = {}
    for r in records:
        m = modules.setdefault(r.module, {"Tests": 0, "Passed": 0, "Failed": 0, "Error": 0, "Skipped": 0})
        m["Tests"] += 1
        m[r.result] += 1
    for name, m in sorted(modules.items()):
        ws.append([name, m["Tests"], m["Passed"], m["Failed"], m["Error"], m["Skipped"]])

    # ---- Test Cases ----
    rows = []
    for i, r in enumerate(records, 1):
        urls = [c.url for c in r.calls]
        payloads = [to_text(c.payload, MAX_BODY) or "—" for c in r.calls]
        outputs = [f"{c.status} {to_text(c.output, MAX_BODY)}".strip() or "—" for c in r.calls]
        expected = ([r.description] if r.description else []) + r.expected
        output = _numbered(outputs) if outputs else ""
        if r.actual:
            checked = "Checked values:\n" + "\n".join(f"- {a}" for a in r.actual)
            output = (output + "\n\n" if output else "") + checked
        if r.error:
            output = (output + "\n\n" if output else "") + "FAILURE: " + r.error
        rows.append([
            i, r.module, r.cls, r.name,
            _numbered(urls) if urls else "(no API call)",
            _numbered(payloads) if payloads and any(p != "—" for p in payloads) else "",
            "\n".join(expected),
            output,
            r.result,
            round(r.duration, 3),
            r.error,
            r.traceback,
        ])
    table(
        wb.create_sheet("Test Cases"),
        ["#", "Module", "Class", "Test", "URL", "Payload", "Expected", "Output", "Passed", "Time (s)", "Failure cause", "Traceback"],
        rows,
        [6, 22, 28, 40, 45, 50, 45, 70, 10, 9, 50, 90],
        result_col=9,
    )

    # ---- Requests ----
    rows = []
    for r in records:
        for step, c in enumerate(r.calls, 1):
            rows.append([f"{r.module}.{r.cls}.{r.name}", step, c.url, to_text(c.payload), c.status, to_text(c.output), r.result])
    table(
        wb.create_sheet("Requests"),
        ["Test", "Step", "URL", "Payload", "Status", "Output", "Passed"],
        rows,
        [60, 6, 50, 60, 12, 80, 10],
        result_col=7,
    )

    wb.save(path)
    return path
