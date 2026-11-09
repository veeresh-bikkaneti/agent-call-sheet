# Vendored three.js

| Field | Value |
| --- | --- |
| Source | npm package `three`, https://registry.npmjs.org/three/-/three-0.186.0.tgz |
| Version | 0.186.0 |
| Tarball integrity | `sha512-cr/fIM2ddMSVbYVgkfD4jLJv7Fh/8ZTjvo+7gQeSVGUZHxpx9FDwoL5iC7hUz/LiRA8wMbqfnb90xKfm1/HHkQ==` (matches `npm view three@0.186.0 dist.integrity`) |
| License | MIT, copied unchanged as `LICENSE` |
| Files used | `build/three.module.js`, `build/three.core.js`, `LICENSE`, copied byte for byte |

SHA-256 of each file, identical to the files inside the tarball:

```
9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea  three.module.js
9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6  three.core.js
8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc  LICENSE
```

The game page loads these from this site only. `features/site/tools/build_sri.py` pins them, with every game module, in the page's import map integrity table. `features/eval/tests/test_live_debugger.py` checks the hashes above.
