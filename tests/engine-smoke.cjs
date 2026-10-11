// SPDX-License-Identifier: AGPL-3.0-or-later
const assert = require('node:assert/strict');
const fs = require('node:fs');
const create = require('../dist/engine.js');
(async () => {
  const e = await create({ wasmBinary: fs.readFileSync(require.resolve('../dist/engine.wasm')) });
  assert.equal(e.UTF8ToString(e._sb_revision()), 'c6a28b0b7e540019a3676bd3322c8b94b06e66b1');
  const samples = new Float32Array(16000 * 12);
  const pointer = e._malloc(samples.byteLength);
  try {
    e.HEAPF32.set(samples, pointer / 4);
    assert.equal(e._sb_analyze(pointer, samples.length), 0);
    assert.equal(JSON.parse(e.UTF8ToString(e._sb_result())).bpm, null);
    assert.equal(e._sb_analyze(pointer, 1), 1);
    samples[0] = NaN;
    e.HEAPF32.set(samples, pointer / 4);
    assert.equal(e._sb_analyze(pointer, samples.length), 1);
    samples.fill(0);
    for (let beat = 0; beat < 24; beat++) for (let i = 0; i < 1600; i++) {
      samples[beat * 8000 + i] = Math.sin(i * 2 * Math.PI * 1000 / 16000) * Math.exp(-i / 150);
    }
    e.HEAPF32.set(samples, pointer / 4);
    assert.equal(e._sb_analyze(pointer, samples.length), 0);
    const r = JSON.parse(e.UTF8ToString(e._sb_result()));
    assert.ok(Number.isFinite(r.bpm) && r.bpm >= 50 && r.bpm <= 210, JSON.stringify(r));
    console.log('Source-pinned WASM startup, silence, invalid input and rhythm smoke: PASS', JSON.stringify(r));
  } finally { e._free(pointer); }
})().catch(error => { console.error(error); process.exitCode = 1; });
