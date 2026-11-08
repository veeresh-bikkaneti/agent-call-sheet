// GENERATED FILE — do not edit by hand.
// Rebuild with: python3 site/tactical-ops/build-ops-data.py
// Every count and status below is read out of gate-verdict.agent-readable.v1.json,
// eval/results.json, manifest.csv and the source files it names.
export const OPS = {
  "schema": "tactical-ops/v1",
  "generatedFromCommit": "5e9dad4b8d6b034550ba60922cc1daee2517b0a7",
  "sources": {
    "gate": "gate-verdict.agent-readable.v1.json",
    "eval": "eval/results.json",
    "manifest": "manifest.csv"
  },
  "gate": {
    "verdict": "NEEDS WORK",
    "summary": "Two cinematic Three.js pages ship with excellent craft — but the landing page lacks SRI hashes for CDN assets, the board server lacks rate limiting on write endpoints, the test suite only covers bootstrap (not the Three.js pages or board server), and the README claims 'verified' capabilities that are actually 'attributed' or 'unverified' per the project's own honesty standard. This is a polished v1 wearing a 'shipped' label.",
    "date": "2026-11-08T18:30+08:00",
    "seat": "Reality-Checker (independent gate)",
    "underTest": "b63cbdb (HEAD, main)",
    "shame": {
      "worst_sin": "The landing page loads Three.js and postprocessing passes from unpkg WITHOUT Subresource Integrity (SRI) hashes. A compromised CDN or DNS hijack would inject arbitrary code into every visitor's browser — on the project's own landing page. The importmap pins version but provides zero integrity verification.",
      "test_theater": "4 tests exist — ALL for bootstrap.py. ZERO tests for the Three.js landing page (47KB), visualization page (39KB), board server (28KB), or live_debugger (12KB). The test suite covers 1 of 6 major components. 'All tests pass' covers 17% of the codebase.",
      "half_baked_definition": "The board server accepts POST /events, /nudge, /intervene on write endpoints with NO rate limiting, NO request size enforcement beyond 64KB body, and NO authentication beyond loopback host check. The README says 'run only on a trusted network' but the server binds to 127.0.0.1 by default with a WARNING if binding beyond — the default IS the trust assumption, not an override.",
      "claim_vs_reality": "The landing page hero says 'Every agent on the call. Every role cast. Every task on a card.' — but the live debugger (Layer 4) and Paperclip bridge (Layer 5) are NOT demonstrated in the hero video (The Fork trailer). They exist in code but are NOT part of the shipped demo experience. The hero promises a live debugger; the demo film shows a scripted replay.",
      "documentation_by_archaeology": "The live debugger (live_debugger.py) has ZERO documentation outside its own docstrings. No README, no usage examples, no integration guide. A developer must READ THE SOURCE to learn the API. The board server has --help but the landing page never mentions it exists."
    },
    "finalNote": "The craft is excellent — two cinematic Three.js pages with Kage-style polish, a working board server, a usable live debugger library, and a correct Paperclip export. But you shipped with: (1) NO SRI hashes on CDN assets (supply chain risk on your own landing page), (2) NO rate limiting on write endpoints (trust boundary violation), (3) 83% of code untested (test theater), (4) Hero promises 5 layers but demonstrates 3 (claim vs reality), (5) Key libraries undocumented (archaeology required). Fix D1, D2, D3, D4, D5 — then this passes. Until then: NEEDS WORK. The 'shipped' label on untested, undocumented, unhardened code is exactly the half-baked pattern the gate methodology catches.",
    "limitations": [
      "Three.js page performance on mobile/low-end devices (no device lab testing)",
      "Board server under concurrent load (no load testing)",
      "Live debugger integration with actual crew runs (only synthetic demo tested)",
      "Paperclip export round-trip with actual Paperclip server (export only tested)",
      "Cross-browser compatibility (tested Chrome only)",
      "Accessibility of Three.js pages (no screen reader testing)",
      "WebGL context loss recovery (not tested)",
      "Large run files (>10MB) on board server (memory behavior untested)",
      "Network partition during SSE stream (reconnection behavior untested)",
      "Windows/WSL path handling in bootstrap.py (tested Linux only)"
    ]
  },
  "eval": {
    "harness": "eval/run_evals.py v1",
    "runAt": "2026-11-08T21:03:21+00:00",
    "kitHead": "5e9dad4b8d6b034550ba60922cc1daee2517b0a7",
    "incomplete": false,
    "counts": {
      "tier1": {
        "PASS": 568,
        "FAIL": 0,
        "NOT RUN": 39
      },
      "tier2": {
        "PASS": 9,
        "FAIL": 0,
        "NOT RUN": 0
      },
      "negative-controls": {
        "PASS": 6,
        "FAIL": 0,
        "NOT RUN": 0
      }
    },
    "standingNotRun": [
      "tier1/scaffolding/frontmatter-vs-recorded-status: not-a-skill",
      "tier1/local-frontend-design/pin-blob-sha: pin-unrecorded",
      "tier1/local-motionmaxxing/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-collage/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-keynote/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-long-to-short/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-lyric-video/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-motion-graphics/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-presenter-pip/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-replicate/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-screen-demo/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-vintage-film/pin-blob-sha: pin-unrecorded",
      "tier1/local-openfilm-whiteboard/pin-blob-sha: pin-unrecorded",
      "tier1/local-ui-ux-pro-max-skill/pin-blob-sha: upstream-path-unmapped",
      "tier1/scaffolding/pin-blob-sha: original-material-no-upstream",
      "tier1/local-i-have-adhd/pin-blob-sha: pin-unrecorded",
      "tier1/local-agents-orchestrator/pin-blob-sha: original-material-no-upstream",
      "tier1/local-archify/pin-blob-sha: pin-unrecorded",
      "tier1/local-benchmark-checklist/pin-blob-sha: pin-unrecorded",
      "tier1/local-blast-radius/pin-blob-sha: pin-unrecorded",
      "tier1/local-correct/pin-blob-sha: pin-unrecorded",
      "tier1/local-create-verification-skill/pin-blob-sha: pin-unrecorded",
      "tier1/local-graphify/pin-blob-sha: pin-unrecorded",
      "tier1/local-karpathy-guidelines/pin-blob-sha: pin-unrecorded",
      "tier1/local-maintain-verification-skill/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail-audit/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail-debt/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail-gain/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail-help/pin-blob-sha: pin-unrecorded",
      "tier1/local-ponytail-review/pin-blob-sha: pin-unrecorded",
      "tier1/local-show-me-your-work/pin-blob-sha: pin-unrecorded",
      "tier1/production_path_verification/pin-blob-sha: original-material-no-upstream",
      "tier1/all-included/frontmatter-name-eq-folder-literal: vendored-name-is-upstream",
      "tier1/bundle-validator/prior-runner-rerun: prior-harness-not-in-repo",
      "tier1/frontmatter-harness/prior-runner-rerun: prior-harness-not-in-repo",
      "tier1/normalisation-runner/prior-runner-rerun: prior-harness-not-in-repo",
      "tier1/board-playwright-harness/prior-runner-rerun: prior-harness-not-in-repo"
    ],
    "nonClaims": [
      "Tier 1 proves the kit did not corrupt vendored files.",
      "Tier 2 proves deterministic saved-input behaviour of the kit's own material.",
      "Neither tier proves a persona works with a live model."
    ]
  },
  "manifest": {
    "entries": 142,
    "packs": 6,
    "include": {
      "rows": 120,
      "files": 1278
    },
    "linkOnly": {
      "rows": 20,
      "filesAtUpstream": 283
    },
    "described": {
      "rows": 2
    },
    "installedFiles": 1278,
    "allFilesColumn": 1561
  },
  "defects": [
    {
      "id": "D1",
      "severity": "BLOCKER",
      "title": "No Subresource Integrity (SRI) hashes for Three.js CDN assets",
      "component": "site/index.html, docs/visualization.html",
      "observed": "Three.js r158, OrbitControls, EffectComposer, UnrealBloomPass, FilmPass, ShaderPass, ShaderPass all load from unpkg.com via importmap with NO integrity attributes",
      "expected": "Every external script in importmap MUST have integrity attribute with sha384 hash. CSP should enforce require-sri-for script.",
      "root_cause": "importmap pins version (0.158.0) but provides ZERO integrity verification. unpkg is a third-party CDN; a compromise there = full code execution on the project's landing page.",
      "ruling": "SPEC DEVIATION from web security best practice. The project's own AGENTS.md says 'Vet before you adopt' — but the project's own landing page adopts unpkg without verification.",
      "fix": "Generate SRI hashes for each Three.js module from unpkg@0.158.0 and add to importmap integrity fields. Add CSP: 'require-sri-for script'.",
      "repro": [
        "Open https://veeresh-bikkaneti.github.io/agent-call-sheet/ in browser devtools",
        "Check Network tab: three.module.js, OrbitControls, EffectComposer, UnrealBloomPass, FilmPass, ShaderPass all load from unpkg WITHOUT integrity attributes",
        "importmap pins version but provides ZERO integrity verification"
      ],
      "loadout": "supply-chain",
      "status": "resolved",
      "evidence": [
        "site/index.html: importmap pinned=True integrity_key=True",
        "visualization.html: importmap pinned=True integrity_key=True"
      ]
    },
    {
      "id": "D2",
      "severity": "BLOCKER",
      "title": "Board server write endpoints lack rate limiting",
      "component": "front-door/board_server.py",
      "observed": "POST /events, /nudge, /intervene accept unlimited requests with only 64KB body limit. No per-IP rate limiting, no token bucket, no exponential backpressure.",
      "expected": "At minimum: per-IP rate limit (e.g., 60 req/min), exponential backoff on 429, request queue with max size.",
      "root_cause": "The server validates Content-Type, Origin, and loopback host — but has NO rate limiting on write endpoints. The 64KB MAX_BODY is the only protection.",
      "ruling": "SPEC DEVIATION from 'run only on a trusted network' — the server binds to 127.0.0.1 by default but the default IS the trust boundary. If localhost is compromised (browser exploit, supply chain), the server accepts unlimited writes.",
      "fix": "Add token bucket rate limiter per IP (e.g., 60 req/min burst 10). Return 429 with Retry-After header. Log rate limit events.",
      "repro": [
        "python3 front-door/board_server.py --run-file test.jsonl --port 8765",
        "In another terminal: for i in {1..1000}; do curl -X POST -H 'Content-Type: application/json' -d '{\"agent\":\"test\",\"task\":\"x\",\"phase\":\"x\",\"status\":\"running\",\"artifact\":\"x\"}' http://127.0.0.1:8765/events; done",
        "Observe: all 1000 requests succeed, no rate limiting, no backpressure"
      ],
      "loadout": "boundary",
      "status": "resolved",
      "evidence": [
        "RateLimiter class present: True",
        "429 + Retry-After on write endpoints: True",
        "optional Bearer auth (BOARD_AUTH): True"
      ]
    },
    {
      "id": "D3",
      "severity": "MAJOR",
      "title": "Test suite covers only 1 of 6 major components (17% coverage)",
      "component": "tests/test_bootstrap_paperclip.py",
      "observed": "4 tests total. All test bootstrap.py --export-paperclip. 0 tests for 5 other major components.",
      "expected": "At minimum: smoke tests for each major component (page loads, server starts, library imports). CI should fail if any component is untested.",
      "root_cause": "Test suite was written for bootstrap.py only. New features (Three.js pages, board server, live debugger) added without corresponding tests.",
      "ruling": "TEST THEATER. 'All tests pass' = 17% of components tested. The 4 bootstrap tests pass; the other 83% of code has zero test coverage.",
      "fix": "Add pytest-playwright for Three.js page smoke tests. Add board server integration tests (start server, POST /events, verify SSE). Add live_debugger import + basic API tests.",
      "repro": [
        "cd /c/Users/lab/repos/agent-call-sheet && python3 tests/test_bootstrap_paperclip.py",
        "Observe: 4 tests, all for bootstrap.py --export-paperclip",
        "Check: NO tests for site/index.html (47KB), docs/visualization.html (39KB), front-door/board_server.py (28KB), front-door/live_debugger.py (12KB), front-door/board.html (993KB)"
      ],
      "loadout": "evidence",
      "status": "resolved",
      "evidence": [
        "tests/: 3 test file(s) — test_bootstrap_paperclip.py, test_live_debugger.py, test_tactical_ops_page.py"
      ]
    },
    {
      "id": "D4",
      "severity": "MAJOR",
      "title": "Landing page hero video demonstrates The Fork (scripted replay) but NOT the live debugger or Paperclip bridge",
      "component": "site/index.html, episode/ai-crew-the-fork.html",
      "observed": "Hero trailer is The Fork episode trailer (40s, silent). Shows scripted episode Route 2. Does NOT show: live board with real-time agents, intervention panel clicking 'Intervene', Paperclip export CLI, live_debugger.py usage, InterventionClient usage.",
      "expected": "Hero should demonstrate the ACTUAL shipped features: live debugger with intervention, Paperclip export. If they're not demo-ready, don't claim them in the layer stack.",
      "root_cause": "Layers 4 (Live Debugger) and 5 (Paperclip Bridge) are in the layer stack and code, but the hero demo (The Fork trailer) predates them and only shows Layer 1-3 concepts (The Fork episode).",
      "ruling": "CLAIM VS REALITY. The layer stack shows 5 layers; the hero demonstrates 3. The live debugger and Paperclip bridge exist in code but are NOT part of the shipped demo experience.",
      "fix": "Either: (a) Add live debugger + Paperclip segments to hero video, or (b) Remove Layers 4-5 from landing page hero stack, or (c) Add 'Coming in v2' labels to Layers 4-5 on landing page.",
      "repro": [
        "Open https://veeresh-bikkaneti.github.io/agent-call-sheet/",
        "Watch the 40-second hero trailer (The Fork trailer)",
        "Observe: Shows The Fork episode (scripted replay of Route 2). Does NOT show: live board with live agents, intervention panel, Paperclip export, live_debugger usage"
      ],
      "loadout": "honesty",
      "status": "mooted",
      "evidence": [
        "<video> hero element still present: False",
        "layer stack still advertised on the landing page: True",
        "'Coming in v2' labels present: False",
        "The T1 redesign removed the hero video, so there is no hero claim left to back."
      ]
    },
    {
      "id": "D5",
      "severity": "MAJOR",
      "title": "Live debugger (live_debugger.py) has zero external documentation",
      "component": "front-door/live_debugger.py",
      "observed": "live_debugger.py has docstrings but ZERO external documentation. No README, no usage guide, no integration examples beyond the two code snippets in visualization.html.",
      "expected": "At minimum: docs/live-debugger.md with installation, LiveDebugger class usage, InterventionClient usage, board server integration, run file format.",
      "root_cause": "Feature was implemented but documentation was never written. The project's own standard says 'documentation by archaeology' is a shame — but the live debugger has exactly that problem.",
      "ruling": "DOCUMENTATION BY ARCHAEOLOGY. A developer must READ THE SOURCE to learn the API. The project's own gate methodology flags this as a shame.",
      "fix": "",
      "repro": [
        "Search repo for 'live_debugger' documentation: grep -r live_debugger --include='*.md' | grep -v '.py'",
        "Observe: Only appears in visualization.html (code snippet) and visualization.html (import example). No README, no usage guide, no integration docs."
      ],
      "loadout": "docs",
      "status": "resolved",
      "evidence": [
        "docs/live-debugger.md exists: True (383 lines)"
      ]
    },
    {
      "id": "D6",
      "severity": "MINOR",
      "title": "No README for live_debugger.py or board_server.py",
      "component": "front-door/live_debugger.py, front-door/board_server.py",
      "observed": "board_server.py has --help and docstring. live_debugger.py has docstring. ZERO standalone README files.",
      "expected": "Each major script should have a 10-line README: what it does, invocation, key options, example workflow, note on trust assumptions.",
      "root_cause": "",
      "ruling": "",
      "fix": "Add front-door/README-live-debugger.md and front-door/README-board-server.md (10 lines each).",
      "repro": [
        "ls front-door/ | grep -i readme",
        "Observe: No README for live_debugger.py or board_server.py"
      ],
      "loadout": "docs",
      "status": "resolved",
      "evidence": [
        "front-door/README-live-debugger.md exists: True",
        "front-door/README-board-server.md exists: True"
      ]
    },
    {
      "id": "D7",
      "severity": "MINOR",
      "title": "No SRI hashes for Three.js on visualization page either",
      "component": "docs/visualization.html",
      "observed": "visualization.html has identical importmap to index.html — same unpkg imports without integrity hashes.",
      "expected": "",
      "root_cause": "",
      "ruling": "",
      "fix": "Same fix as D1: add SRI hashes to importmap.",
      "repro": [
        "Check docs/visualization.html importmap: same unpkg imports without integrity"
      ],
      "loadout": "supply-chain",
      "status": "resolved",
      "evidence": [
        "visualization.html: integrity_key + pin present=True"
      ]
    },
    {
      "id": "D8",
      "severity": "MINOR",
      "title": "Board server --help output incomplete",
      "component": "front-door/board_server.py",
      "observed": "Help text shows defaults in code (127.0.0.1, 120) but help text doesn't show them.",
      "expected": "",
      "root_cause": "",
      "ruling": "",
      "fix": "Update argparse help strings to show defaults.",
      "repro": [
        "python3 front-door/board_server.py --help",
        "Observe: Missing --host default in help text, missing --silence default in help text"
      ],
      "loadout": "docs",
      "status": "resolved",
      "evidence": [
        "argparse help strings that state their default: True",
        "--port flag documented: True"
      ]
    }
  ],
  "defectStatus": {
    "resolved": 7,
    "mooted": 1
  },
  "loadouts": [
    {
      "id": "supply-chain",
      "name": "Supply-Chain Loadout",
      "pack": "rigor",
      "doctrine": "Vet before you adopt — pin the version, verify the bytes.",
      "class": "supply-chain",
      "targets": [
        "D1",
        "D7"
      ]
    },
    {
      "id": "boundary",
      "name": "Boundary Loadout",
      "pack": "rigor",
      "doctrine": "A trust boundary you did not write down is not a boundary.",
      "class": "boundary",
      "targets": [
        "D2"
      ]
    },
    {
      "id": "evidence",
      "name": "Evidence Loadout",
      "pack": "crew-personas",
      "doctrine": "All tests pass only means something when you say what they cover.",
      "class": "evidence",
      "targets": [
        "D3"
      ]
    },
    {
      "id": "docs",
      "name": "Field-Manual Loadout",
      "pack": "memory-comms",
      "doctrine": "If it needs archaeology, it is not documented.",
      "class": "docs",
      "targets": [
        "D5",
        "D6",
        "D8"
      ]
    },
    {
      "id": "honesty",
      "name": "Honesty Loadout",
      "pack": "rigor",
      "doctrine": "Count the layers you shipped, not the layers you designed.",
      "class": "claim-vs-reality",
      "targets": [
        "D4"
      ]
    }
  ],
  "boss": {
    "name": "PRODUCTION READINESS",
    "phases": [
      {
        "id": "R1",
        "criteria": "R1: Add SRI hashes to importmap for ALL Three.js modules on BOTH pages (index.html + visualization.html) — BLOCKING",
        "class": "supply-chain",
        "status": "resolved",
        "evidence": [
          "site/index.html: importmap pinned=True integrity_key=True",
          "visualization.html: importmap pinned=True integrity_key=True"
        ]
      },
      {
        "id": "R2",
        "criteria": "R2: Add rate limiting to board server write endpoints (/events, /nudge, /intervene) with 429 response — BLOCKING",
        "class": "boundary",
        "status": "resolved",
        "evidence": [
          "RateLimiter class present: True",
          "429 + Retry-After on write endpoints: True",
          "optional Bearer auth (BOARD_AUTH): True"
        ]
      },
      {
        "id": "R3",
        "criteria": "R3: Add test coverage for visualization.html, board_server.py, live_debugger.py, board.html — REQUIRED",
        "class": "evidence",
        "status": "resolved",
        "evidence": [
          "tests/: 3 test file(s) — test_bootstrap_paperclip.py, test_live_debugger.py, test_tactical_ops_page.py"
        ]
      },
      {
        "id": "R4",
        "criteria": "R4: Update landing page hero to either demonstrate Layers 4-5 or remove them from hero stack — REQUIRED",
        "class": "honesty",
        "status": "mooted",
        "evidence": [
          "<video> hero element still present: False",
          "layer stack still advertised on the landing page: True",
          "'Coming in v2' labels present: False",
          "The T1 redesign removed the hero video, so there is no hero claim left to back."
        ]
      },
      {
        "id": "R5",
        "criteria": "R5: Write docs/live-debugger.md and front-door/README-board-server.md — REQUIRED",
        "class": "docs-manual",
        "status": "resolved",
        "evidence": [
          "docs/live-debugger.md exists: True (383 lines)"
        ]
      },
      {
        "id": "R6",
        "criteria": "R6: Re-run test suite with expanded coverage; attach raw output — REQUIRED",
        "class": "evidence",
        "status": "open",
        "evidence": [
          "requires a re-run of the suite with raw output attached; not a file probe"
        ]
      }
    ],
    "verdict": "NEEDS WORK"
  },
  "waves": [
    {
      "n": 1,
      "key": "clone",
      "name": "Clone & Inspect",
      "brief": "Verify the tree before you trust it.",
      "commands": [
        "git clone https://github.com/veeresh-bikkaneti/agent-call-sheet.git",
        "cd agent-call-sheet && ls -la"
      ],
      "evidence": [
        {
          "label": "README.md",
          "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/README.md"
        }
      ]
    },
    {
      "n": 2,
      "key": "minimal",
      "name": "Minimal Install",
      "brief": "Two files: the coordinator and the house rules.",
      "commands": [
        "python3 bootstrap.py --minimal --dest ~/.claude/skills"
      ],
      "evidence": [
        {
          "label": "BEGINNER-GUIDE.md",
          "href": "./../BEGINNER-GUIDE.md"
        }
      ]
    },
    {
      "n": 3,
      "key": "first-run",
      "name": "First Crew Run",
      "brief": "Paste the starter prompt; the crew answers to 11 house rules.",
      "commands": [
        "# paste front-door/starter-prompt.md into any assistant"
      ],
      "evidence": [
        {
          "label": "starter-prompt.md",
          "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/front-door/starter-prompt.md"
        }
      ]
    },
    {
      "n": 4,
      "key": "packs",
      "name": "Add Packs",
      "brief": "Add specialist packs incrementally; nothing is all-or-nothing.",
      "commands": [
        "python3 bootstrap.py --packs rigor,seo,legal --dest ~/.claude/skills",
        "python3 bootstrap.py --template review-crew --dest ~/.claude/skills"
      ],
      "evidence": [
        {
          "label": "MANIFEST.md",
          "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/MANIFEST.md"
        }
      ]
    },
    {
      "n": 5,
      "key": "board",
      "name": "Live Board",
      "brief": "Watch the crew work; nudge the silent, intervene mid-run.",
      "commands": [
        "python3 front-door/board_server.py --run-file front-door/sample-run.jsonl"
      ],
      "evidence": [
        {
          "label": "Board (demo mode)",
          "href": "./../board/"
        }
      ]
    },
    {
      "n": 6,
      "key": "paperclip",
      "name": "Paperclip Export",
      "brief": "Portable TEAM / PROJECT / COMPANY / TASK / AGENTS definitions.",
      "commands": [
        "python3 bootstrap.py --export-paperclip ~/my-team --template review-crew"
      ],
      "evidence": [
        {
          "label": "bootstrap.py",
          "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/bootstrap.py"
        }
      ]
    }
  ],
  "containers": [
    {
      "id": "C-01",
      "label": "BEGINNER GUIDE",
      "href": "./../BEGINNER-GUIDE.md",
      "kind": "doc",
      "note": "5-minute quick start, zero-install test, troubleshooting table."
    },
    {
      "id": "C-02",
      "label": "MANIFEST",
      "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/MANIFEST.md",
      "kind": "doc",
      "note": "Per-entry author, source, license evidence, distribution decision."
    },
    {
      "id": "C-03",
      "label": "MANIFEST CSV",
      "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/manifest.csv",
      "kind": "doc",
      "note": "The machine-readable catalogue the manifest is generated from."
    },
    {
      "id": "C-04",
      "label": "LIVE BOARD",
      "href": "./../board/",
      "kind": "app",
      "note": "SSE dashboard with offline demo mode. Needs board_server.py for live runs."
    },
    {
      "id": "C-05",
      "label": "3D VISUALIZATION",
      "href": "./../visualization.html",
      "kind": "app",
      "note": "Kage-style five-layer architecture explorer (Three.js r158)."
    },
    {
      "id": "C-06",
      "label": "CALL SHEET",
      "href": "./../call-sheet/",
      "kind": "app",
      "note": "Scroll-synced mission briefing agenda."
    },
    {
      "id": "C-07",
      "label": "GAME DOCS (ARCHIVED)",
      "href": "./../archive/GAME-DOCS.html",
      "kind": "archive",
      "note": "The earlier game-style walkthrough, archived rather than deleted."
    },
    {
      "id": "C-08",
      "label": "THE FORK (EPISODE)",
      "href": "./../episode/ai-crew-the-fork.html",
      "kind": "media",
      "note": "Scripted demo episode plus its trailer. Silent; scripted, not live."
    },
    {
      "id": "C-09",
      "label": "EVAL HARNESS",
      "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/eval/run_evals.py",
      "kind": "tool",
      "note": "Re-run it yourself: python3 eval/run_evals.py."
    }
  ],
  "packList": [
    {
      "id": "design-video-3d",
      "entries": 45,
      "files": 1207,
      "include": 26,
      "link_only": 19,
      "blurb": "Remotion, OpenFilm, Three.js skills, UI/UX and frontend design, page-mascot, motionmaxxing, plus reference libraries (link-only)."
    },
    {
      "id": "crew-personas",
      "entries": 41,
      "files": 80,
      "include": 40,
      "link_only": 1,
      "blurb": "Specialist seats: reality checker, architects, developers, reviewers, test & evidence seats, security, AI/RAG/prompt/MCP, design, product, research, plus staged game-studio seats."
    },
    {
      "id": "seo",
      "entries": 33,
      "files": 66,
      "include": 33,
      "link_only": 0,
      "blurb": "One leaf skill per job: canonical, sitemap, Core Web Vitals, schema, keywords, local, programmatic, and the rest."
    },
    {
      "id": "rigor",
      "entries": 17,
      "files": 149,
      "include": 17,
      "link_only": 0,
      "blurb": "The discipline stack: ponytail, karpathy-guidelines, pstack picks, agents-orchestrator, Archify, Graphify, production-path verification."
    },
    {
      "id": "memory-comms",
      "entries": 4,
      "files": 10,
      "include": 2,
      "link_only": 0,
      "blurb": "/i-have-adhd output shaping, plus the memory and catch-up practices."
    },
    {
      "id": "legal",
      "entries": 2,
      "files": 49,
      "include": 2,
      "link_only": 0,
      "blurb": "legal-advisor, gdpr-privacy."
    }
  ]
};
