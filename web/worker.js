// Copyright (C) 2026 Sesini Bul. SPDX-License-Identifier: AGPL-3.0-or-later
// Audio is supplied locally by the browser; no network uploads.
importScripts('../dist/engine.js');
self.onmessage = async ({ data }) => {
  let engine, pointer = 0;
  try {
    const samples = data.samples;
    if (!(samples instanceof Float32Array) || samples.length < 128000 || samples.length > 9600000) {
      throw new Error('8 saniye ile 10 dakika arasında bir kayıt seç.');
    }
    self.postMessage({ type: 'stage', percent: 10, stage: 'Motor hazırlanıyor' });
    engine = await SBEngine({ locateFile: name => new URL('../dist/' + name, self.location.href).href });
    pointer = engine._malloc(samples.byteLength);
    if (!pointer) throw new Error('Bu cihazda yeterli bellek yok. Daha kısa bir dosya seç.');
    engine.HEAPF32.set(samples, pointer / 4);
    self.postMessage({ type: 'stage', percent: 30, stage: 'BPM ve ton hesaplanıyor' });
    if (engine._sb_analyze(pointer, samples.length) !== 0) throw new Error('Ses analiz edilemedi. Başka bir dosyayla dene.');
    const value = JSON.parse(engine.UTF8ToString(engine._sb_result()));
    self.postMessage({ type: 'result', result: {
      bpm: Number.isFinite(value.bpm) ? Math.round(value.bpm) : null,
      key: value.key && ['major', 'minor'].includes(value.scale)
        ? value.key + (value.scale === 'major' ? ' majör' : ' minör') : null,
      alternateKey: null, seconds: samples.length / 16000,
    } });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Analiz tamamlanamadı.' });
  } finally {
    if (engine && pointer) engine._free(pointer);
    self.close();
  }
};
