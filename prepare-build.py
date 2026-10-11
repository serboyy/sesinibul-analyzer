"""Source-visible build configuration modifications; no algorithm modifications.
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
(root / 'pkgconfig/eigen3.pc').write_text(
    f'Name: Eigen3\nDescription: Pinned Eigen source headers\nVersion: 3.4.0\n'
    f'Cflags: -I{root / "eigen"}\nLibs:\n')
