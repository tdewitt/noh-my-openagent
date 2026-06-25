#!/usr/bin/env node
// fork/customize.mjs
//
// Idempotent fork customizer. Re-applies our minimal local build delta onto a
// fresh upstream checkout WITHOUT git merges (so package.json version churn never
// conflicts). Run after `git reset --hard upstream/dev`. Safe to run repeatedly.
//
//   node fork/customize.mjs
//
// Policy: track upstream as-is (names, binaries, branding) EXCEPT where it costs
// us functionality or builds we don't use. The agent-frontmatter code change lives
// in a normal git commit, not here. This script only trims the build pipeline:
//   - drop the Codex plugin steps (we run OpenCode, never Codex)
//   - drop the `prepare` hook so `bun install` doesn't auto-run a full build

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
let changed = 0

function editText(relPath, mutate) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) {
    console.log(`- ${relPath}: not found, skipping`)
    return
  }
  const before = readFileSync(abs, "utf-8")
  const after = mutate(before)
  if (after !== before) {
    writeFileSync(abs, after, "utf-8")
    console.log(`  updated ${relPath}`)
    changed++
  } else {
    console.log(`= ${relPath}: already up to date`)
  }
}

editText("package.json", (text) => {
  const pkg = JSON.parse(text)

  // Don't auto-build on `bun install`; the publish path uses prepublishOnly.
  if (pkg.scripts) delete pkg.scripts.prepare

  // Drop Codex from the build chain (we don't ship/run the Codex harness).
  if (pkg.scripts?.build) {
    pkg.scripts.build = pkg.scripts.build
      .replace("bun run build:codex-plugin && ", "")
      .replace("bun run build:codex-install && ", "")
  }

  return JSON.stringify(pkg, null, 2) + "\n"
})

console.log(changed === 0 ? "\nNothing to do — already customized." : `\nDone (${changed} file(s) updated).`)
