#!/usr/bin/env bash
# Idempotent bootstrap for the mikeornstein.com Hugo site.
# Installs the pinned Hugo Extended release (matching .github/workflows/hugo.yml)
# and fetches the PaperMod theme tracked as a git submodule.
set -euo pipefail

HUGO_VERSION="0.124.1"

if ! command -v hugo >/dev/null 2>&1 || ! hugo version | grep -q "v${HUGO_VERSION}.*+extended"; then
  echo "Installing Hugo Extended v${HUGO_VERSION}..."
  tmpdeb="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$tmpdeb" \
    "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb"
  sudo dpkg -i "$tmpdeb"
  rm -f "$tmpdeb"
else
  echo "Hugo Extended v${HUGO_VERSION} already present; skipping install."
fi

echo "Fetching theme submodule(s)..."
git submodule update --init --recursive

hugo version
