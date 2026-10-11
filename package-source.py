"""Package only this independent public project and pinned public dependencies.
SPDX-License-Identifier: AGPL-3.0-or-later
"""
import gzip
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parent
build = root / '.build'
dist = root / 'dist'
own_paths = ['LICENSE', 'README.md', '.gitignore', 'engine.cpp', 'build.sh',
             'prepare-build.py', 'package-source.py', 'tests', '.github', 'web']

def revision(path):
    return subprocess.check_output(['git', '-C', str(path), 'rev-parse', 'HEAD'], text=True).strip()

sources = {
    'fftw': {'url': 'https://www.fftw.org/fftw-3.3.11.tar.gz', 'sha256': '5630c24cdeb33b131612f7eb4b1a9934234754f9f388ff8617458d0be6f239a1'},
    'essentia': {'repository': 'https://github.com/MTG/essentia.git', 'revision': revision(build / 'essentia')},
    'eigen': {'repository': 'https://gitlab.com/libeigen/eigen.git', 'revision': revision(build / 'eigen')},
    'emsdk': {'repository': 'https://github.com/emscripten-core/emsdk.git', 'revision': revision(build / 'emsdk')}
}
expected = {'essentia': 'c6a28b0b7e540019a3676bd3322c8b94b06e66b1',
            'eigen': '3147391d946bb4b6c68edd901f2add6ac1f31f8c',
            'emsdk': '0b3bcbc3b005cbb811d48e497eabcc6846d43001'}
for name, value in sources.items():
    if name == 'fftw':
        if hashlib.sha256((build / 'fftw.tar.gz').read_bytes()).hexdigest() != value['sha256']:
            raise RuntimeError('FFTW source archive hash mismatch')
        continue
    if value['revision'] != expected[name]:
        raise RuntimeError('Source revision mismatch: ' + name)

def add_file(archive, path, prefix, base):
    if path.is_symlink():
        raise RuntimeError('Unexpected source symlink: ' + str(path))
    relative = path.relative_to(base)
    if path.is_dir():
        for child in sorted(path.iterdir()):
            if child.name in {'.git', 'build', '__pycache__'} or child.name.startswith('.lock-waf'):
                continue
            add_file(archive, child, prefix, base)
    elif path.is_file():
        info = archive.gettarinfo(str(path), arcname=prefix + '/' + str(relative))
        info.uid = info.gid = 0
        info.uname = info.gname = ''
        info.mtime = 0
        with path.open('rb') as content:
            archive.addfile(info, content)

with (dist / 'corresponding-source.tar.gz').open('wb') as raw:
    with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name in own_paths:
                path = root / name
                if path.exists():
                    add_file(archive, path, 'analyzer', root)
            for name in ['essentia', 'eigen']:
                add_file(archive, build / name, 'dependencies/' + name, build / name)
            add_file(archive, build / 'fftw-source', 'dependencies/fftw', build / 'fftw-source')
            # SDK installer/config source, not installed multi-GB compiler output.
            # Compilers/general-purpose tools are not part of the linked work.
            sdk = build / 'emsdk'
            tracked = subprocess.check_output(['git', '-C', str(sdk), 'ls-files'], text=True).splitlines()
            for name in tracked:
                add_file(archive, sdk / name, 'build-tools/emsdk', sdk)

hashes = {name: hashlib.sha256((dist / name).read_bytes()).hexdigest()
          for name in ['engine.js', 'engine.wasm', 'corresponding-source.tar.gz']}
provenance = {'sources': sources, 'compiler': 'Emscripten 3.1.64', 'sha256': hashes,
              'modifiedUpstreamFiles': ['essentia/wscript: add -fexceptions',
                  'essentia/src/algorithms/rhythm/percivalevaluatepulsetrains.cpp: resize score vectors before indexed writes'],
              'algorithmChanges': True, 'pretrainedModels': False,
              'license': 'AGPL-3.0-or-later; dependency notices included in source archive'}
(dist / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print('Corresponding source and provenance packaged:', json.dumps(hashes))
