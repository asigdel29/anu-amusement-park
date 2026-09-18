#!/bin/sh
# Bakes and compresses the park in one step, from the committed .blend.
#
# Contract: leaves public/models/park/ and assets/pipeline/pins.json holding the
# current park, built from assets/park.blend. Wrapped by `npm run assets:export`.
#
# This does NOT rebuild the .blend. Regenerating the scene itself is a separate,
# deliberate step, because it discards any interactive authoring not yet written
# back into assets/park_build.py:
#
#   blender --background --python assets/park_build.py -- assets/park.blend
set -e

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
EXPORT_DIR="${TMPDIR:-/tmp}/park-export"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"

if [ ! -x "$BLENDER" ]; then
  echo "Blender not found at $BLENDER; set BLENDER to its path" >&2
  exit 1
fi

mkdir -p "$EXPORT_DIR"
"$BLENDER" --background "$REPO/assets/park.blend" \
  --python "$REPO/assets/pipeline/bake_export.py" -- "$EXPORT_DIR"
sh "$REPO/assets/pipeline/compress.sh" "$EXPORT_DIR"
