import sys
from typing import List
from . import gptAPI

USAGE = """
AI-Applying CLI

Usage:
  python -m ai_applying generate "prompt"
  python -m ai_applying chat "message"
  python -m ai_applying stream "prompt"
"""


def main(argv: List[str]):
    if len(argv) < 2:
        print(USAGE)
        return
    cmd = argv[1]
    arg = " ".join(argv[2:]) if len(argv) > 2 else ""

    if cmd == "generate":
        print(gptAPI.generate_text(arg))
    elif cmd == "chat":
        # simple chat wrapper
        print(gptAPI.chat([{"role": "user", "content": arg}]))
    elif cmd == "stream":
        for chunk in gptAPI.stream_text(arg):
            print(chunk, end="", flush=True)
        print()
    else:
        print(USAGE)


if __name__ == "__main__":
    main(sys.argv)
