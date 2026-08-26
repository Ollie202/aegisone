# hello-proofrail

Deterministic M1 fixture. `node build.mjs` reads the committed source message and writes exactly one canonical release artifact. Tests place this source in a deterministic Git repository, pin its real commit SHA, then make the local runner clone and rebuild that SHA in a separate temporary checkout.

The committed file under `fixtures/publisher/` represents the bytes distributed by the publisher. A copy with one changed byte must return `MISMATCH`.
