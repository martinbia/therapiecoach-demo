"""Offline Tests for the static preflight only; no app or cloud functionality."""
import json
import tempfile
import unittest
from pathlib import Path
from preflight import REQUIRED, TOOLS, run_checks, strip_jsonc, tool_names_from_json


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data, encoding='utf-8')

    def fixture(self):
        for files in REQUIRED.values():
            for file in files:
                self.write(file, '{}')
        for doc in ('API_CONTRACT.md', 'ARCHITECTURE.md'):
            self.write('docs/' + doc, '# Contract\n**Version:** 1.0\n**Status:** APPROVED\n')
        self.write('worker/wrangler.jsonc', json.dumps({
            'durable_objects': {'bindings': [{'name': 'LIMITER', 'class_name': 'AccessLimiter'}]},
            'migrations': [{'tag': 'v1', 'new_sqlite_classes': ['AccessLimiter']}] }))
        self.write('agent/tool_schemas.json', json.dumps({'tools': [{'name': x, 'schema': {}} for x in TOOLS]}))
        self.write('web/src/voice/elevenlabs.ts', 'conversationToken webrtc clientTools')
        self.write('web/src/access/token.ts', "fetch('',{credentials: 'omit'})")
        self.write('.github/workflows/frontend-pages.yml', 'uses: actions/deploy-pages@v4')

    def test_missing_components_are_blocked(self):
        statuses = [x.status for x in run_checks(self.root)]
        self.assertIn('BLOCKED', statuses)
        self.assertTrue(any(c.category == 'security' and c.status == 'BLOCKED' for c in run_checks(self.root)))

    def test_complete_synthetic_structure_passes_without_fail(self):
        self.fixture()
        checks = run_checks(self.root)
        self.assertNotIn('BLOCKED', [c.status for c in checks])
        self.assertNotIn('FAIL', [c.status for c in checks])
        self.assertIn('WARN', [c.status for c in checks])  # Lockfiles missing

    def test_bold_version_is_accepted(self):
        self.fixture()
        self.write('docs/API_CONTRACT.md', '**Version:** **1.0**\n**Status:** **APPROVED**')
        checks = [c for c in run_checks(self.root) if c.category == 'contract']
        self.assertFalse(any(c.status == 'FAIL' for c in checks))

    def test_rejects_invalid_sqlite_binding(self):
        self.fixture()
        self.write('worker/wrangler.jsonc', '{"durable_objects":{"bindings":[]},"migrations":[]}')
        self.assertTrue(any(c.status == 'FAIL' and 'SQLite' in c.detail for c in run_checks(self.root)))

    def test_rejects_seventh_tool(self):
        self.fixture()
        self.write('agent/tool_schemas.json', json.dumps({'tools': [{'name': x} for x in (*TOOLS, 'newTool')]}))
        self.assertTrue(any(c.category == 'agent' and c.status == 'FAIL' for c in run_checks(self.root)))

    def test_rejects_unexpected_missing_tool(self):
        self.fixture()
        self.write('agent/tool_schemas.json', json.dumps({'tools': {k: {} for k in TOOLS[:-1]}}))
        self.assertTrue(any(c.category == 'agent' and c.status == 'FAIL' for c in run_checks(self.root)))

    def test_detects_literal_key_assignment(self):
        self.fixture()
        self.write('web/src/access/token.ts', "const ELEVENLABS_API_KEY='secret-value-123456';\ncredentials: 'omit'")
        self.assertTrue(any(c.category == 'security' and c.status == 'FAIL' for c in run_checks(self.root)))

    def test_jsonc_comments_and_commas(self):
        data = '{ // one\n "url": "https://example.com/a//b", /* two */ "a": [1,], }'
        self.assertEqual(json.loads(strip_jsonc(data)), {'url': 'https://example.com/a//b', 'a': [1]})

    def test_tool_names_for_schema_shapes(self):
        self.assertEqual(tool_names_from_json({'tools': {'openInfo': {}, 'openVideo': {}}}), {'openInfo', 'openVideo'})
        self.assertEqual(tool_names_from_json([{'name': 'openInfo'}]), {'openInfo'})


if __name__ == '__main__':
    unittest.main()
