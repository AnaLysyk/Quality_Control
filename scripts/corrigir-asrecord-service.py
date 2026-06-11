from pathlib import Path
import re

path = Path("lib/accessRequestsV2/service.ts")
content = path.read_text(encoding="utf-8")

# Garante helper asRecord
if "function asRecord(" not in content:
    # coloca depois da função asText, independente de onde ela esteja
    content = re.sub(
        r'(function asText\([\s\S]*?\n\})',
        r'''\1

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
''',
        content,
        count=1,
    )

# Garante helper pickFirstText também
if "function pickFirstText(" not in content:
    content = re.sub(
        r'(function asRecord\([\s\S]*?\n\})',
        r'''\1

function pickFirstText(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }

  return "";
}
''',
        content,
        count=1,
    )

path.write_text(content, encoding="utf-8")
