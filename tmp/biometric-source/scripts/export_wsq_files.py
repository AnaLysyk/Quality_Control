import io
import os
from pathlib import Path

import wsq
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(r"C:\Users\Testing Company\Pictures\Screenshots\Digitais")
OUTPUT_DIR = ROOT / "wsq_output"

FINGER_MAP = [
    (0, "polegar direto.png", "polegar_direito.wsq"),
    (1, "indicador direito .png", "indicador_direito.wsq"),
    (2, "medio direito.png", "medio_direito.wsq"),
    (3, "Anelar direito.png", "anelar_direito.wsq"),
    (4, "Mínimo direito.png", "minimo_direito.wsq"),
    (5, "Polegar esquerdo.png", "polegar_esquerdo.wsq"),
    (6, "Indicador esquerdo.png", "indicador_esquerdo.wsq"),
    (7, "Médio esquerdo.png", "medio_esquerdo.wsq"),
    (8, "Anelar esquerdo .png", "anelar_esquerdo.wsq"),
    (9, "Mínimo esquerdo .png", "minimo_esquerdo.wsq"),
]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    converted = 0
    for index, source_name, output_name in FINGER_MAP:
        source_path = SOURCE_DIR / source_name
        output_path = OUTPUT_DIR / output_name

        if not source_path.exists():
            print(f"[{index}] AUSENTE: {source_path}")
            continue

        image = Image.open(source_path).convert("L")
        buffer = io.BytesIO()
        image.save(buffer, "WSQ")
        output_path.write_bytes(buffer.getvalue())

        print(f"[{index}] {source_name} -> {output_name} ({output_path.stat().st_size} bytes)")
        converted += 1

    print(f"Total exportado: {converted}")
    print(f"Pasta de saída: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()