#!/usr/bin/env python3
"""Miniature authentique Soustraction -> WebP compact. Source publique, moteur intact."""
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image, ImageOps

SOURCE = "https://raw.githubusercontent.com/Mr-Tat/Miniatures-Mathas/main/soustraction-ecrite.png"
TARGET = Path("assets/miniatures/soustraction-ecrite-simple.webp")
MAX_SOURCE = 4 * 1024 * 1024

def main():
    req = Request(SOURCE, headers={"User-Agent": "Mathas-Connect-Soustraction-miniature/1.0"})
    with urlopen(req, timeout=30) as response:
        image_bytes = response.read(MAX_SOURCE + 1)
    if not image_bytes.startswith(b"\x89PNG\r\n\x1a\n") or len(image_bytes) > MAX_SOURCE:
        raise ValueError("La source n'est pas la miniature PNG attendue")
    with Image.open(BytesIO(image_bytes)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((320, 320), Image.Resampling.LANCZOS)
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        image.save(TARGET, format="WEBP", quality=77, method=6)
    payload = TARGET.read_bytes()
    if not 1000 < len(payload) <= 80_000:
        raise ValueError(f"Miniature WebP trop lourde ou vide : {len(payload)} octets")
    print(f"Miniature Soustraction publiée : {image.width} x {image.height}, {len(payload)} octets ({100*(1-len(payload)/len(image_bytes)):.1f}% de réduction)")

if __name__ == "__main__":
    main()
