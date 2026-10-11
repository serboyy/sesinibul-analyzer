// Copyright (C) 2026 Sesini Bul. SPDX-License-Identifier: AGPL-3.0-or-later
// Independent browser analyzer; no account, payment or server upload code.
#include <algorithm>
#include <cmath>
#include <memory>
#include <sstream>
#include <string>
#include <vector>
#include <emscripten/emscripten.h>
#include "essentia.h"
#include "algorithmfactory.h"

static std::string result;
extern "C" {
EMSCRIPTEN_KEEPALIVE const char* sb_revision() { return SB_ESSENTIA_REVISION; }
EMSCRIPTEN_KEEPALIVE const char* sb_result() { return result.c_str(); }
EMSCRIPTEN_KEEPALIVE int sb_analyze(const float* input, int count) {
  using namespace essentia;
  using namespace essentia::standard;
  result = "{}";
  if (!input || count < 16000 * 8 || count > 16000 * 600) return 1;
  double energy = 0;
  for (int i = 0; i < count; ++i) {
    if (!std::isfinite(input[i])) return 1;
    energy += double(input[i]) * input[i];
  }
  if (energy / count < 1e-9) {
    result = "{\"bpm\":null,\"key\":null,\"scale\":null,\"strength\":0}";
    return 0;
  }
  try {
    if (!isInitialized()) init();
    std::vector<Real> samples(input, input + count);
    Real bpm = 0, strength = 0;
    std::string key, scale;
    bool rhythmOk = false, keyOk = false;
    try {
      std::unique_ptr<Algorithm> rhythm(AlgorithmFactory::create("PercivalBpmEstimator",
        "sampleRate", 16000, "frameSize", 1024, "frameSizeOSS", 2048,
        "hopSize", 128, "hopSizeOSS", 128, "minBPM", 50, "maxBPM", 210));
      rhythm->input("signal").set(samples);
      rhythm->output("bpm").set(bpm);
      rhythm->compute();
      rhythmOk = std::isfinite(bpm) && bpm >= 50 && bpm <= 210;
    } catch (const std::exception&) { rhythmOk = false; }
    try {
      std::unique_ptr<Algorithm> tonal(AlgorithmFactory::create("KeyExtractor",
        "sampleRate", 16000.0, "frameSize", 4096, "hopSize", 4096,
        "hpcpSize", 12, "minFrequency", 25.0, "maxFrequency", 3500.0,
        "maximumSpectralPeaks", 60, "pcpThreshold", 0.2,
        "profileType", "bgate", "spectralPeaksThreshold", 0.0001,
        "tuningFrequency", 440.0, "weightType", "cosine",
        "windowType", "hann", "averageDetuningCorrection", true));
      tonal->input("audio").set(samples);
      tonal->output("key").set(key);
      tonal->output("scale").set(scale);
      tonal->output("strength").set(strength);
      tonal->compute();
      const std::vector<std::string> keys = {"C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"};
      keyOk = std::find(keys.begin(), keys.end(), key) != keys.end()
        && (scale == "major" || scale == "minor")
        && std::isfinite(strength) && strength >= 0.55;
    } catch (const std::exception&) { keyOk = false; }
    std::ostringstream json;
    json << "{\"bpm\":";
    if (rhythmOk) json << bpm; else json << "null";
    json << ",\"key\":";
    if (keyOk) json << '"' << key << '"'; else json << "null";
    json << ",\"scale\":";
    if (keyOk) json << '"' << scale << '"'; else json << "null";
    json << ",\"strength\":" << (std::isfinite(strength) ? strength : 0) << '}';
    result = json.str();
    return 0;
  } catch (const std::exception&) { return 1; }
}
}
