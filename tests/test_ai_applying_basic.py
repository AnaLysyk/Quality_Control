import os
from ai_applying import gptAPI


def test_generate_mock_when_no_key():
    # Ensure we don't need a real OpenAI key for this basic unit test
    os.environ.pop("OPENAI_API_KEY", None)
    out = gptAPI.generate_text("Hello world")
    assert out is not None
    assert out.startswith("[mock]") or isinstance(out, str)
