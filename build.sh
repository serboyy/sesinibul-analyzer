#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
task_root="$(cd "$(dirname "$0")" && pwd)"
task_build="$task_root/.build"
essentia_revision=c6a28b0b7e540019a3676bd3322c8b94b06e66b1
eigen_revision=3147391d946bb4b6c68edd901f2add6ac1f31f8c
emsdk_revision=0b3bcbc3b005cbb811d48e497eabcc6846d43001
mkdir -p "$task_build" "$task_root/dist"
fetch_source() {
  local task_url="$1" task_revision="$2" task_dir="$3"
  test ! -e "$task_dir"
  git init -q "$task_dir"
  git -C "$task_dir" remote add origin "$task_url"
  git -C "$task_dir" fetch --depth 1 origin "$task_revision"
  git -C "$task_dir" checkout --detach FETCH_HEAD
  test "$(git -C "$task_dir" rev-parse HEAD)" = "$task_revision"
}
fetch_source https://github.com/MTG/essentia.git "$essentia_revision" "$task_build/essentia"
fetch_source https://gitlab.com/libeigen/eigen.git "$eigen_revision" "$task_build/eigen"
fetch_source https://github.com/emscripten-core/emsdk.git "$emsdk_revision" "$task_build/emsdk"
"$task_build/emsdk/emsdk" install 3.1.64
"$task_build/emsdk/emsdk" activate 3.1.64
source "$task_build/emsdk/emsdk_env.sh"
export EMSCRIPTEN="$EMSDK/upstream/emscripten"
mkdir -p "$task_build/pkgconfig"
python3 "$task_root/prepare-build.py" "$task_build" "$eigen_revision"
export PKG_CONFIG_PATH="$task_build/pkgconfig"
cd "$task_build/essentia"
emconfigure python3 waf configure --emscripten --build-static --lightweight= --fft=KISS --pkg-config-path="$task_build/pkgconfig" \
  --ignore-algos=Spline,CubicSpline,NNLSChroma,SNR \
  --include-algos=PercivalBpmEstimator,PercivalEnhanceHarmonics,PercivalEvaluatePulseTrains,KeyExtractor,FrameCutter,Windowing,Spectrum,Magnitude,FFT,UnaryOperator,Flux,IIR,AutoCorrelation,PeakDetection,SpectralPeaks,SpectralWhitening,HPCP,Key,NoiseAdder
emmake python3 waf build -j2
em++ -Oz -std=c++14 -fexceptions "$task_root/engine.cpp" build/src/libessentia.a \
  -Isrc -Isrc/essentia -Isrc/essentia/scheduler -Isrc/essentia/streaming \
  -Isrc/essentia/streaming/algorithms -Isrc/essentia/utils -Isrc/3rdparty \
  -DSB_ESSENTIA_REVISION=\""$essentia_revision"\" \
  -s MODULARIZE=1 -s EXPORT_NAME=SBEngine -s ENVIRONMENT=web,worker,node \
  -s DYNAMIC_EXECUTION=0 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=268435456 \
  -s DISABLE_EXCEPTION_CATCHING=0 \
  -s EXPORTED_FUNCTIONS='["_sb_analyze","_sb_result","_sb_revision","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["UTF8ToString"]' \
  -o "$task_root/dist/engine.js"
cd "$task_root"
node tests/engine-smoke.cjs
python3 package-source.py
