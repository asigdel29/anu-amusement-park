#!/bin/sh
# Compresses the exported park for the web, into public/models/park/.
#
# Contract: given the directory bake_export.py wrote, produces
# public/models/park/Park.glb with Draco-compressed geometry and WebP textures.
#
# Usage: sh assets/pipeline/compress.sh <export_dir>
#
# WebP rather than KTX2/Basis, deliberately. KTX2 would roughly halve GPU
# memory, but it needs the external `ktx` binary as a build dependency. The
# navigation reference does ship Basis and this pipeline will too, but only once
# a measurement shows GPU memory is the actual ceiling — until then the extra
# build dependency costs more than it returns. src/park/useGLTFUnlit.ts already
# wires a self-hosted KTX2Loader, so that switch is a pipeline change and not an
# application one.
#
# --simplify is off: the park is 9,485 polygons of deliberately flat-shaded
# geometry, and a decimator would round off exactly the chamfers that keep it
# from looking like programmer art.
set -e

EXPORT_DIR="$1"
if [ -z "$EXPORT_DIR" ]; then
  echo "usage: sh assets/pipeline/compress.sh <export_dir>" >&2
  exit 2
fi

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO/public/models/park"
mkdir -p "$OUT"

for f in "$EXPORT_DIR"/*.glb; do
  base="$(basename "$f" .glb)"
  npx --yes @gltf-transform/cli optimize "$f" "$OUT/$base.glb" \
    --compress draco \
    --texture-compress webp \
    --simplify false
  echo "compressed $base: $(wc -c < "$OUT/$base.glb") bytes"
done

npx --yes @gltf-transform/cli inspect "$OUT/Park.glb" | head -40
