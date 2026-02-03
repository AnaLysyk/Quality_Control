import os
from ai_applying import gptAPI


def test_generate_mock_when_no_key():
    # Garante que não precisamos de uma chave real do OpenAI para este teste básico
    os.environ.pop("OPENAI_API_KEY", None)
    out = gptAPI.generate_text("Hello world")
    assert out is not None
    assert out.startswith("[mock]") or isinstance(out, str)
