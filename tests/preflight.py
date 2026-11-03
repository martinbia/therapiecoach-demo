#!/usr/bin/env python3
"""Statische Integrations-Vorpruefung fuer therapiecoach-demo (kein Laufzeittest).

Python-Standardbibliothek, ohne Cloudzugriff. Exit 0=keine Blocker,
1=vorhandene Quelle verletzt einen Pruefpunkt, 2=Quellkomponenten fehlen.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

TOOLS = (
    'openInfo', 'openVideo', 'openLogbook',
    'proposeLogEntry', 'confirmLogEntry', 'setProactivity',
)
REQUIRED = {
    'web': (
        'web/package.json', 'web/src/core/dispatcher.ts',
        'web/src/voice/elevenlabs.ts', 'web/src/voice/mock.ts',
        'web/src/access/token.ts', 'web/src/ui/app.ts',
    ),
    'worker': (
        'worker/package.json', 'worker/wrangler.jsonc',
        'worker/src/index.ts', 'worker/src/limiter-store.ts',
        'worker/src/session.ts',
    ),
    'agent': ('agent/tool_schemas.json',),
    'contract': ('docs/ARCHITECTURE.md', 'docs/API_CONTRACT.md'),
}

@dataclass
class Check:
    category: str
    status: str
    detail: str


def text_or_empty(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except (OSError, UnicodeError):
        return ''


def strip_jsonc(src: str) -> str:
    """Remove comments outside strings and trailing commas before ] / }."""
    out = []
    in_string = False
    escaped = False
    i = 0
    while i < len(src):
        c = src[i]
        if in_string:
            out.append(c)
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            out.append(c)
            i += 1
            continue
        if c == '/' and i + 1 < len(src) and src[i + 1] == '/':
            i += 2
            while i < len(src) and src[i] not in '\r\n':
                i += 1
            continue
        if c == '/' and i + 1 < len(src) and src[i + 1] == '*':
            end = src.find('*/', i + 2)
            if end == -1:
                raise ValueError('unvollstaendiger Blockkommentar')
            i = end + 2
            continue
        out.append(c)
        i += 1
    return re.sub(r',\s*(?=[}\]])', '', ''.join(out))


def tool_names_from_json(value: object) -> set[str]:
    """Recognize typical list-of-tools or dict keyed by tool names.

    Parameter schema property names are deliberately ignored.
    """
    if isinstance(value, list):
        result: set[str] = set()
        for item in value:
            if isinstance(item, dict) and isinstance(item.get('name'), str):
                result.add(item['name'])
            else:
                result.update(tool_names_from_json(item))
        return result
    if isinstance(value, dict):
        for key in ('tools', 'clientTools', 'client_tools', 'schemas'):
            if key in value:
                val = value[key]
                if isinstance(val, dict):
                    return set(val)
                return tool_names_from_json(val)
        # root can be a name -> schema map
        if value and all(isinstance(v, dict) for v in value.values()) and (
                set(value).intersection(TOOLS)):
            return set(value)
        if isinstance(value.get('name'), str):
            return {value['name']}
    return set()


def run_checks(root: Path) -> list[Check]:
    checks: list[Check] = []
    root = root.resolve()
    for component, paths in REQUIRED.items():
        missing = [p for p in paths if not (root / p).is_file()]
        if missing:
            checks.append(Check(component, 'BLOCKED', 'Fehlende Quellen: ' + ', '.join(missing)))
        else:
            checks.append(Check(component, 'PASS', f'{len(paths)} erwartete Dateien vorhanden'))

    for document in ('ARCHITECTURE.md', 'API_CONTRACT.md'):
        path = root / 'docs' / document
        if path.is_file():
            data = text_or_empty(path)
            status = 'PASS' if 'APPROVED' in data and re.search(r'Version:\**\s*\**1\.0\**', data) else 'FAIL'
            checks.append(Check('contract', status, f'{document}: APPROVED v1.0'))

    wrangler = root / 'worker/wrangler.jsonc'
    if wrangler.exists():
        try:
            data = json.loads(strip_jsonc(text_or_empty(wrangler)))
            bindings = data.get('durable_objects', {}).get('bindings', [])
            has_binding = any(b.get('class_name') == 'AccessLimiter' for b in bindings if isinstance(b, dict))
            migrations = data.get('migrations', [])
            sqlite_migration = any('AccessLimiter' in m.get('new_sqlite_classes', []) for m in migrations if isinstance(m, dict))
            exports = data.get('exports', {})
            sqlite_export = isinstance(exports, dict) and exports.get('AccessLimiter', {}).get('storage') == 'sqlite'
            ok = has_binding and (sqlite_migration or sqlite_export)
            checks.append(Check('worker', 'PASS' if ok else 'FAIL',
                'SQLite Durable Object Binding AccessLimiter und Migration/Export'))
        except (ValueError, TypeError, AttributeError) as exc:
            checks.append(Check('worker', 'FAIL', f'wrangler.jsonc unlesbar: {exc}'))

    schema = root / 'agent/tool_schemas.json'
    if schema.exists():
        try:
            parsed = json.loads(text_or_empty(schema))
            names = tool_names_from_json(parsed)
            if not names:
                checks.append(Check('agent', 'WARN', 'Tool-Schema-Format nicht erkannt: manuell pruefen'))
            else:
                missing = set(TOOLS) - names
                extra = names - set(TOOLS)
                checks.append(Check('agent', 'PASS' if not missing and not extra else 'FAIL',
                    'Client Tools exakt: ' + (', '.join(sorted(names)) or '(keine)') +
                    ('; fehlen: ' + ', '.join(sorted(missing)) if missing else '') +
                    ('; unzulaessig: ' + ', '.join(sorted(extra)) if extra else '')))
        except json.JSONDecodeError as exc:
            checks.append(Check('agent', 'FAIL', f'Ungueltige JSON Tool-Schemas: {exc}'))

    eleven = root / 'web/src/voice/elevenlabs.ts'
    if eleven.exists():
        source = text_or_empty(eleven)
        missing = [s for s in ('conversationToken', 'webrtc', 'clientTools') if s not in source]
        checks.append(Check('web', 'WARN' if missing else 'PASS',
                            'ElevenLabs-Adapter statische Indikatoren: ' +
                            ('fehlen ' + ', '.join(missing) if missing else 'Token/WebRTC/Client-Tools vorhanden')))

    token = root / 'web/src/access/token.ts'
    if token.exists():
        source = text_or_empty(token)
        checks.append(Check('web', 'PASS' if re.search(r'''credentials\s*:\s*['"]omit['"]''', source) else 'WARN',
            "TokenProvider: credentials:'omit' statisch sichtbar"))

    for name in ('web/package-lock.json', 'worker/package-lock.json'):
        checks.append(Check('reproducibility', 'PASS' if (root / name).is_file() else 'WARN',
            name + (' vorhanden' if (root / name).is_file() else ' fehlt: npm ci noch nicht reproduzierbar')))

    workflow = root / '.github/workflows/frontend-pages.yml'
    if not workflow.exists():
        checks.append(Check('deployment', 'WARN', 'Frontend-Pages-Workflow nicht auffindbar'))
    else:
        source = text_or_empty(workflow)
        checks.append(Check('deployment', 'PASS' if 'deploy-pages' in source else 'WARN',
            'Frontend-GitHub-Actions-Pages-Deployment statisch erkennbar'))

    # Very narrow checks to avoid false positives; a PASS is no comprehensive secret audit.
    suspects = []
    literal = re.compile(r'''(?i)\b(?:DEMO_PIN|ELEVENLABS_API_KEY|IP_HASH_KEY)\b\s*[:=]\s*['"]([^'"\n]{8,})['"]''')
    for directory in ('web', 'worker', 'agent', '.github/workflows'):
        folder = root / directory
        if not folder.is_dir():
            continue
        for path in folder.rglob('*'):
            if not path.is_file() or (path.suffix not in ('.ts', '.js', '.json', '.jsonc', '.yaml', '.yml', '.html') and not path.name.startswith('.env')):
                continue
            if any(part in ('node_modules', 'dist', 'build') for part in path.parts):
                continue
            for match in literal.finditer(text_or_empty(path)):
                value = match.group(1).lower()
                if any(marker in value for marker in ('placeholder', 'example', 'changeme', 'your_', 'test-', '${', '<', 'process.env', 'env.')):
                    continue
                suspects.append(str(path.relative_to(root)))
    missing_source_dirs = [d for d in ('web', 'worker', 'agent') if not (root / d).is_dir()]
    sec_status = 'FAIL' if suspects else ('BLOCKED' if missing_source_dirs else 'PASS')
    sec_detail = ('Moegliche literal kodierte Secrets: ' + ', '.join(sorted(set(suspects)))) if suspects else (
        'Codeverzeichnisse fehlen, keine Secret-Pruefung moeglich: ' + ', '.join(missing_source_dirs)
        if missing_source_dirs else
        'Kein offensichtliches Literal-Secret in untersuchten Code/Konfig-Dateien (keine vollstaendige Secret-Pruefung)')
    checks.append(Check('security', sec_status, sec_detail))

    return checks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--json-output', type=Path)
    parser.add_argument('--allow-incomplete', action='store_true', help='Handoffs ohne Code als Baseline erlauben')
    args = parser.parse_args(argv)
    checks = run_checks(args.root)
    for check in checks:
        print(f'{check.status:7s} {check.category:16s} {check.detail}')
    counts = {status: sum(c.status == status for c in checks) for status in ('PASS', 'WARN', 'FAIL', 'BLOCKED')}
    print('SUMMARY', json.dumps(counts, sort_keys=True))
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps({'root': str(args.root), 'checks': [asdict(c) for c in checks],
           'totals': counts}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    if counts['FAIL']:
        return 1
    if counts['BLOCKED'] and not args.allow_incomplete:
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
