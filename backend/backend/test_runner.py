"""
Test runner that also writes an Excel test log (see api/test/test_log.py).

Set in settings.TEST_RUNNER, so every `python manage.py test ...` produces
backend/test_log/test_log_<date>_<time>_<all | module names>.xlsx. Add --no-test-log to skip it.
"""
from django.conf import settings
from django.test.runner import DiscoverRunner

TEST_LOG_DIR = settings.BASE_DIR / "test_log"


class TestLogRunner(DiscoverRunner):
    def __init__(self, *args, test_log=True, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_log = test_log
        self.recorder = None
        self.test_labels = []

    @classmethod
    def add_arguments(cls, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--no-test-log",
            action="store_false",
            dest="test_log",
            help="Don't write the Excel test log to test_log/.",
        )

    def run_tests(self, test_labels, *args, **kwargs):
        self.test_labels = list(test_labels or [])
        return super().run_tests(test_labels, *args, **kwargs)

    def get_resultclass(self):
        base = super().get_resultclass()
        if not self.test_log:
            return base
        import unittest
        from api.test.test_log import make_result_class

        return make_result_class(base or unittest.TextTestResult, self.recorder)

    def run_suite(self, suite, **kwargs):
        if not self.test_log:
            return super().run_suite(suite, **kwargs)
        if self.parallel > 1:
            # results come back from worker processes, which this recorder can't see
            self.log("Test log: skipped with --parallel (run without it to get the Excel file).")
            return super().run_suite(suite, **kwargs)

        from datetime import datetime
        from api.test.test_log import TestLogRecorder, write_excel

        self.recorder = TestLogRecorder()
        self.recorder.install()
        try:
            result = super().run_suite(suite, **kwargs)
        finally:
            self.recorder.uninstall()
            self.recorder.finished_at = datetime.now()
            try:
                path = write_excel(self.recorder, self.test_labels, TEST_LOG_DIR)
                self.log(f"\nTest log written to {path}")
            except Exception as exc:  # never fail the test run because of the log
                self.log(f"\nTest log could not be written: {exc!r}")
        return result
