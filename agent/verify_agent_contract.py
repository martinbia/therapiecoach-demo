#!/usr/bin/env python3
"""Offline static checks for the approved API_CONTRACT.md v1.0 tool definitions.

This does not interact with ElevenLabs and makes no billed API calls.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
obj = json.loads((ROOT / "tool_schemas.json").read_text(encoding="utf-8"))
tools = obj["tools"]
expected = {
    "openInfo": {"topicId": "string"},
    "openVideo": {"videoId": "string"},
    "openLogbook": {},
    "proposeLogEntry": {"exerciseId": "string", "when": "string", "comment": "string"},
    "confirmLogEntry": {"confirmed": "boolean"},
    "setProactivity": {"enabled": "boolean"},
}
assert len(tools) == len(expected) == 6
assert set(t["name"] for t in tools) == set(expected)
assert len({t["name"] for t in tools}) == 6


def schema_validate(params, payload):
    if not isinstance(payload, dict):
        return False
    properties = params["properties"]
    if not set(params["required"]).issubset(payload):
        return False
    if params.get("additionalProperties") is False and (set(payload) - set(properties)):
        return False
    for name, value in payload.items():
        spec = properties[name]
        typ = spec["type"]
        if typ == "string":
            if not isinstance(value, str):
                return False
            if len(value) < spec.get("minLength", 0) or len(value) > spec.get("maxLength", 10**9):
                return False
        elif typ == "boolean":
            if not isinstance(value, bool):
                return False
        else:
            return False
        if "enum" in spec and value not in spec["enum"]:
            return False
    return True


def has(name, payload):
    return schema_validate(next(t["parameters"] for t in tools if t["name"] == name), payload)


for t in tools:
    assert t["type"] == "client" and t["wait_for_response"] is True
    params = t["parameters"]
    assert params["type"] == "object" and params["additionalProperties"] is False
    assert set(params["properties"]) == set(expected[t["name"]])
    assert set(params["required"]) == set(expected[t["name"]])
    for name, typ in expected[t["name"]].items():
        assert params["properties"][name]["type"] == typ
    print("PASS", t["name"], "param names/types; Client; Wait for response")

assert has("openInfo", {"topicId": "stairs"})
assert not has("openInfo", {"topicId": "unknown"})
assert not has("openInfo", {"topicId": "stairs", "url": "https://example.com"})
assert has("openVideo", {"videoId": "chair_rise_demo"})
assert not has("openVideo", {"videoId": "other"})
assert has("openLogbook", {})
assert not has("openLogbook", {"anything": 3})
assert has("proposeLogEntry", {"exerciseId": "chair_rise", "when": "heute Morgen", "comment": "gut"})
assert not has("proposeLogEntry", {"exerciseId": "chair_rise", "when": "", "comment": "gut"})
assert not has("proposeLogEntry", {"exerciseId": "chair_rise", "when": "x" * 81, "comment": "gut"})
assert not has("proposeLogEntry", {"exerciseId": "chair_rise", "when": "heute", "comment": "x" * 241})
assert not has("proposeLogEntry", {"exerciseId": "unsupported", "when": "heute", "comment": "gut"})
assert has("confirmLogEntry", {"confirmed": True})
assert not has("confirmLogEntry", {"confirmed": "true"})
assert has("setProactivity", {"enabled": False})
assert not has("setProactivity", {"enabled": 0})
print("PASS 16 JSON payload checks (valid and invalid)")
# Optional direct comparison to an APPROVED local API_CONTRACT.md, if present.
import re
contract_candidates = [ROOT.parent / "API_CONTRACT.md", ROOT.parent / "docs" / "API_CONTRACT.md"]
for contract in contract_candidates:
    if contract.exists():
        contents = contract.read_text(encoding="utf-8")
        assert "Status:** **APPROVED" in contents
        tool_table = contents.split("### 5.1 Tool-Payloads und Wirkung", 1)[1].split("### 5.2", 1)[0]
        from_contract = set(re.findall(r"^\| `([A-Za-z]+)` \|", tool_table, flags=re.MULTILINE))
        assert from_contract == set(expected), (from_contract, set(expected))
        print("PASS exact six names compared with", contract.name)
        break
else:
    print("NOTE: APPROVED API_CONTRACT.md absent; using frozen v1.0 fixture expectations")

for filename in ["PERSONA_ANNA.md", "CLIENT_TOOLS.md", "AGENT_CONFIGURATION.md", "HANDOFF_ELEVENLABS.md"]:
    txt = (ROOT / filename).read_text(encoding="utf-8")
    for tool_name in expected:
        assert tool_name in txt, (filename, tool_name)
print("PASS six tool names referenced in all four Markdown files")
print("PASS: Offline tool-schema checks complete. No ElevenLabs dashboard or real call tested.")
