#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor/model/ssdlite_mobilenet_v2 vendor/model/blazeface
curl -fsSL -o vendor/tf.min.js https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js
curl -fsSL -o vendor/coco-ssd.min.js https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js
base=https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2
curl -fsSL -o vendor/model/ssdlite_mobilenet_v2/model.json "$base/model.json"
for i in 1 2 3 4 5; do
  curl -fsSL -o "vendor/model/ssdlite_mobilenet_v2/group1-shard${i}of5" "$base/group1-shard${i}of5"
done
curl -fsSL -o vendor/blazeface.min.js https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.umd.js
for f in model.json group1-shard1of1.bin; do
  curl -fsSL -o "vendor/model/blazeface/$f" "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/$f?tfjs-format=file"
done
ls -la vendor vendor/model/ssdlite_mobilenet_v2 vendor/model/blazeface
shasum -a 256 -c scripts/vendor.sha256
