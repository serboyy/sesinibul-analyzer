"""Source-visible build configuration and upstream memory-safety correction.
SPDX-License-Identifier: AGPL-3.0-or-later
"""
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve(strict=True)
wscript = root / 'essentia/wscript'
original = wscript.read_text()
needle = "ctx.env.CXXFLAGS = ['-std=' + ctx.options.STD]"
if original.count(needle) != 1:
    raise RuntimeError('Unexpected upstream compiler flag configuration')
wscript.write_text(original.replace(needle, needle + " + ['-fexceptions']"))
pulse = root / 'essentia/src/algorithms/rhythm/percivalevaluatepulsetrains.cpp'
pulse_source = pulse.read_text()
for name in ('tempoScores', 'onsetScores'):
    needle = f'{name}.reserve(peakPositions.size());'
    if pulse_source.count(needle) != 1:
        raise RuntimeError('Unexpected upstream pulse score allocation: ' + name)
    # reserve does not create elements. Indexed writes and sum() require size.
    pulse_source = pulse_source.replace(needle, f'{name}.resize(peakPositions.size());')
pulse.write_text(pulse_source)
(root / 'pkgconfig/eigen3.pc').write_text(
    f'Name: Eigen3\nDescription: Pinned Eigen source headers\nVersion: 3.4.0\n'
    f'Cflags: -I{root / "eigen"}\nLibs:\n')
