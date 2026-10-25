#!/usr/bin/env python3
"""Import public Math'as assets into Connect only; never modify legacy Math'as."""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageOps, UnidentifiedImageError

BASE = "https://jftzuslpelgzbdrftszw.supabase.co/storage/v1/object/public/mathas-images/"
SRC = {
    "addition": "miniatures/optimise-v17-10-addition-simple-1791797141830-1uykou3.webp",
    "wordmark": "logos/logo-mot-1791065255634-jznxux.png",
    "icon": "logos/embleme-neon-mathematique-avec-m-en-3d-1791285482515-dyxa8v.png",
}
MAX_DOWNLOAD = 8 * 1024 * 1024
OUT = Path("assets")

def download(name: str, path: str):
    req = Request(BASE + path, headers={"User-Agent": "Mathas-Connect-image-migration/1.0"})
    with urlopen(req, timeout=45) as res:
        ct = res.headers.get("Content-Type", "")
        if not ct.lower().startswith("image/"):
            raise ValueError(f"{name}: content-type inattendu {ct!r}")
        raw = res.read(MAX_DOWNLOAD + 1)
    if len(raw) > MAX_DOWNLOAD:
        raise ValueError(f"{name}: image trop volumineuse")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as ex:
        raise ValueError(f"{name}: fichier image invalide") from ex
    return img, len(raw)

def optimized(img: Image.Image, size: tuple[int, int], fmt: str) -> bytes:
    img = ImageOps.exif_transpose(img)
    img.thumbnail(size, Image.Resampling.LANCZOS)
    img = img.convert("RGBA")
    output = io.BytesIO()
    if fmt == "WEBP":
        img.save(output, format="WEBP", quality=83, method=6, exact=True)
    else:
        img.save(output, format="PNG", optimize=True)
    return output.getvalue()

def store(path: str, content: bytes, name: str, old_size: int) -> dict:
    dest = OUT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    if len(content) > 200 * 1024:
        raise ValueError(f"{path}: image toujours trop lourde ({len(content)} octets)")
    dest.write_bytes(content)
    with Image.open(io.BytesIO(content)) as img:
        size = [img.width, img.height]
    return {
        "path": "assets/" + path,
        "source": SRC[name],
        "source_bytes": old_size,
        "bytes": len(content),
        "dimensions": size,
        "sha256": hashlib.sha256(content).hexdigest()
    }

def main():
    rows = []
    img, count = download("addition", SRC["addition"])
    rows.append(store("miniatures/addition-ecrite-simple.webp", optimized(img, (480, 480), "WEBP"), "addition", count))
    img, count = download("wordmark", SRC["wordmark"])
    rows.append(store("brand/mathas-wordmark.webp", optimized(img, (850, 280), "WEBP"), "wordmark", count))
    img, count = download("icon", SRC["icon"])
    rows.append(store("brand/favicon.png", optimized(img.copy(), (64, 64), "PNG"), "icon", count))
    rows.append(store("brand/apple-touch-icon.png", optimized(img, (180, 180), "PNG"), "icon", count))
    (OUT / "images-manifest.json").write_text(
        json.dumps({"version": 1, "assets": rows}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )
    print("Assets Connect optimisés:")
    for row in rows:
        print(f"  {row['path']}: {row['bytes']} octets {row['dimensions']}")

if __name__ == "__main__":
    main()
