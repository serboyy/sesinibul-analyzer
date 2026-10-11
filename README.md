# Sesini Bul — independent analyzer

An independent browser-local BPM and major/minor key analyzer. No login,
payment APIs, user data, recordings, uploads or secrets are part of this project.
This project is **not yet a production release**.

License: AGPL-3.0-or-later; see LICENSE. No warranty or accuracy guarantee.
Essentia algorithms and vendored dependencies retain their original notices.
No pretrained models are used. Source code may be modified and redistributed
under its applicable licenses.

## Source build

`bash build.sh` starts from a clean checkout on Linux with git, Python 3,
pkg-config and Node available. It installs the pinned official Emscripten SDK
inside `.build`, fetches pinned Essentia and Eigen sources, builds only the
required algorithm graph with FFTW 3.3.11, and runs smoke tests. Compiler flags
are modified explicitly by `prepare-build.py`; algorithms are not modified.
The new C API avoids legacy JavaScript runtime dynamic compilation.

The manual workflow uses a standard Ubuntu runner **only for a public repo**.
It uses no cache, no Actions artifact upload, no paid/larger runners, and no
automatic website deployment. Successful output is committed to this public
repository, including its complete corresponding-source archive and provenance.

Real-music browser regressions and mobile execution must be tested on the
actual built binary before release. Tests of the old npm WASM binary do not
prove accuracy of this new source build.
