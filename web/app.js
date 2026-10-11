// Copyright (C) 2026 Sesini Bul. SPDX-License-Identifier: AGPL-3.0-or-later
const element = id => document.getElementById(id);
let worker = null, serial = 0, timer = null, currentResult = null, busy = false;
for (let slice = 0; slice < 17; slice++) {
  const part = document.createElement('i'); part.style.setProperty('--slice', slice); element('ring').append(part);
}
function stop() { worker?.terminate(); worker = null; clearTimeout(timer); timer = null; busy = false; }
function fail(message) { stop(); element('sculpture').dataset.busy = 'false'; element('error').textContent = message; element('error').hidden = false; element('cancel').hidden = true; element('upload').hidden = false; element('headline').textContent = 'Yeniden dene'; }
function reset() {
  serial++; stop(); currentResult = null; element('results').hidden = true; element('prompt').hidden = false;
  element('status').textContent = '';
  element('error').hidden = true; element('cancel').hidden = true; element('upload').hidden = false;
  element('headline').textContent = 'Sesi sürükle'; element('drop').dataset.result = 'false';
  element('sculpture').dataset.busy = 'false'; element('sculpture').dataset.done = 'false';
}
function mono(channels) {
  const samples = new Float32Array(channels[0].length); let strongest = channels[0], strongestEnergy = 0;
  for (const channel of channels) {
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      if (!Number.isFinite(channel[i])) throw new Error('Ses verisi okunamadı.');
      samples[i] += channel[i] / channels.length; energy += channel[i] * channel[i];
    }
    if (energy > strongestEnergy) { strongest = channel; strongestEnergy = energy; }
  }
  let total = 0; for (const value of samples) total += value * value;
  if (total < strongestEnergy * .1) samples.set(strongest);
  return samples;
}
async function select(file) {
  reset(); const id = serial;
  if (file.size > 40 * 1024 * 1024 || !file.size) return fail('En fazla 40 MB boyutunda bir ses dosyası seç.');
  if (!/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return fail('MP3, WAV, M4A, AAC, OGG veya FLAC dosyası seç.');
  busy = true; element('headline').textContent = 'Dosya açılıyor…'; element('upload').hidden = true; element('cancel').hidden = false; element('sculpture').dataset.busy = 'true';
  timer = setTimeout(() => { if (serial === id) { serial++; fail('Analiz çok uzun sürdü. Daha kısa bir dosyayla dene.'); } }, 90000);
  try {
    const bytes = await file.arrayBuffer(); if (serial !== id) return;
    if (!window.OfflineAudioContext) throw new Error('Güncel Safari veya Chrome ile dene.');
    const decoded = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(bytes); if (serial !== id) return;
    if (decoded.duration < 8 || decoded.duration > 600 || decoded.numberOfChannels > 32) throw new Error('8 saniye ile 10 dakika arasında bir kayıt seç.');
    const samples = mono(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)));
    worker = new Worker('worker.js');
    worker.onerror = () => { if (serial === id) fail('Analiz motoru açılamadı. Sayfayı yenileyip yeniden dene.'); };
    worker.onmessageerror = () => { if (serial === id) fail('Analiz sonucu okunamadı.'); };
    worker.onmessage = ({ data }) => {
      if (serial !== id) return;
      if (data.type === 'stage') { element('headline').textContent = data.stage + '…'; return; }
      if (data.type === 'error') return fail(data.message);
      if (data.type !== 'result') return;
      stop(); currentResult = { ...data.result, name: file.name };
      element('filename').textContent = file.name; element('bpm').textContent = data.result.bpm ?? 'Belirsiz'; element('key').textContent = data.result.key ?? 'Belirsiz';
      element('note').textContent = 'Tahmini sonuç · ' + Math.round(data.result.seconds) + ' saniye analiz edildi.';
      element('prompt').hidden = true; element('results').hidden = false; element('drop').dataset.result = 'true';
      element('sculpture').dataset.busy = 'false'; element('sculpture').dataset.done = 'true'; element('status').textContent = 'Analiz tamamlandı.';
    };
    worker.postMessage({ samples }, [samples.buffer]);
  } catch (error) { if (serial === id) fail(error.name === 'EncodingError' ? 'Ses dosyası açılamadı. MP3 veya WAV ile dene.' : error.message); }
}
for (const id of ['upload', 'another']) element(id).addEventListener('click', () => element('file').click());
element('file').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; if (file) void select(file); });
element('cancel').addEventListener('click', reset);
element('copy').addEventListener('click', async () => {
  if (!currentResult) return;
  try { await navigator.clipboard.writeText(`${currentResult.name}\nBPM: ${currentResult.bpm ?? 'Belirsiz'}\nTon: ${currentResult.key ?? 'Belirsiz'}\nSesini Bul · https://sesinibul.com`); element('status').textContent = 'Sonuçlar kopyalandı.'; }
  catch { element('error').textContent = 'Kopyalama izni verilmedi. Sonuçları elle kopyalayabilirsin.'; element('error').hidden = false; }
});
element('drop').addEventListener('dragover', event => { event.preventDefault(); if (!busy) element('drop').classList.add('dragging'); });
element('drop').addEventListener('dragleave', event => { if (!element('drop').contains(event.relatedTarget)) element('drop').classList.remove('dragging'); });
element('drop').addEventListener('drop', event => { event.preventDefault(); element('drop').classList.remove('dragging'); if (!busy && event.dataTransfer.files[0]) void select(event.dataTransfer.files[0]); });
const sculpture = element('sculpture');
sculpture.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = sculpture.getBoundingClientRect();
  sculpture.style.setProperty('--tilt-x', `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 32}deg`);
  sculpture.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 44}deg`);
});
sculpture.addEventListener('pointerleave', () => { sculpture.style.setProperty('--tilt-x', '0deg'); sculpture.style.setProperty('--tilt-y', '0deg'); });
document.addEventListener('visibilitychange', () => { sculpture.dataset.paused = String(document.hidden); });
window.addEventListener('pagehide', () => { serial++; stop(); });
