---
name: clean-review
description: Review a text file for clear headings and concise paragraphs. Use when a user asks for a lightweight document-structure review.
license: MIT
compatibility: Requires Python 3 for the optional local checker.
metadata:
  author: proofrail-fixture
  version: "1"
allowed-tools: Read
---

# Clean Review

1. Read the requested text file.
2. Identify headings and unusually long paragraphs.
3. Return concise recommendations without changing files automatically.

For deterministic local checking, run `scripts/check.py` with a text-file path.
