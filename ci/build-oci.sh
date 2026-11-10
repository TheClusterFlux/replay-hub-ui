#!/usr/bin/env bash
set -euo pipefail
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
base=docker.io/library/nginx@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11
layout="ocidir://$work/image"
site="$work/layer/usr/share/nginx/html"
mkdir -p "$site" "$work/layer/etc/nginx/conf.d"
cp nginx.conf "$work/layer/etc/nginx/conf.d/default.conf"
cp -r index.html video.html styles.css app.js video.js js "$site/"
for script in "$site"/*.js "$site"/js/*.js; do node --input-type=module --check < "$script"; done
grep -q 'listen *8080;' nginx.conf
grep -q 'app.js' index.html
grep -q 'video.js' video.html
sha256sum index.html | cut -d' ' -f1 > "$OUTPUT_DIR/page.sha256"
regctl image copy --platform linux/amd64 "$base" "$layout:base"
tar -C "$work/layer" --owner=0 --group=0 --numeric-owner -cf "$work/site.tar" .
regctl image mod "$layout:base" --create "$layout:release" --layer-add "tar=$work/site.tar" \
  --label "org.opencontainers.image.revision=$SOURCE_SHA" --label "org.opencontainers.image.source=https://github.com/TheClusterFlux/replay-hub-ui"
regctl image digest "$layout:release" > "$OUTPUT_DIR/image.digest"
regctl image export "$layout:release" "$OUTPUT_DIR/image.tar"
