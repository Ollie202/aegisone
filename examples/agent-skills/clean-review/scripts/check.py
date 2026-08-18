#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
long_count = sum(len(part) > 500 for part in paragraphs)
print(f"paragraphs={len(paragraphs)} long={long_count}")
