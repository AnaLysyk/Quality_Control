"""Command-line interface for ai_applying package."""

import sys
from typing import List

from . import gptAPI

USAGE = """
AI-Applying CLI

Usage:
  python -m ai_applying generate "prompt" [--model MODEL]
  python -m ai_applying chat "message" [--model MODEL]
  python -m ai_applying stream "prompt" [--model MODEL]

Examples:
  python -m ai_applying generate "Explain JWT simply"
  python -m ai_applying chat "hello"
  python -m ai_applying stream "write a poem"
"""


def _parse_model(argv: List[str]) -> str:
    if "--model" in argv:
        idx = argv.index("--model")
        if idx + 1 < len(argv):
            return argv[idx + 1]
    return gptAPI.DEFAULT_MODEL


def _strip_flags(argv: List[str], model: str) -> str:
    cleaned: List[str] = []
    skip_next = False
    for idx, value in enumerate(argv):
        if skip_next:
            skip_next = False
            continue
        if value == "--model":
            skip_next = True
            continue
        if value == model and idx > 0 and argv[idx - 1] == "--model":
            # already skipped via --model branch
            continue
        cleaned.append(value)
    return " ".join(cleaned).strip()


def main(argv: List[str]) -> None:
    if len(argv) < 3:
        print(USAGE)
        return

    cmd = argv[1]
    model = _parse_model(argv)
    argument = _strip_flags(argv[2:], model)

    if not argument:
        print("Argumento de texto obrigatório.\n")
        print(USAGE)
        return

    try:
        if cmd == "generate":
            print(gptAPI.generate_text(argument, model=model))
        elif cmd == "chat":
            print(gptAPI.chat([{"role": "user", "content": argument}], model=model))
        elif cmd == "stream":
            for chunk in gptAPI.stream_text(argument, model=model):
                print(chunk, end="", flush=True)
            print()
        else:
            print("Comando inválido.\n")
            print(USAGE)
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário.")
    except Exception as exc:  # pragma: no cover - CLI safety
        print(f"[CLI ERROR] {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main(sys.argv)
