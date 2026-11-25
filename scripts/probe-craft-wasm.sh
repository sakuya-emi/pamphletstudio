#!/bin/sh
# Read-only prerequisites probe; no downloads or system changes.
missing=0
for tool in cargo rustc trunk wasm-bindgen; do
  if command -v "$tool" >/dev/null 2>&1; then
    command -v "$tool"
  else
    echo "$tool: not installed"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo 'Upstream WASM build is not verified on this machine.'
  exit 1
fi
rustc --version
rustup target list --installed
