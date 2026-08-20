#!/usr/bin/env node
// bin/dsh-rightclick-open.mjs
// A tiny command line to install / remove / check the right-click menu
// WITHOUT needing a running dsh. After `npm install -g dsh-rightclick-open`
// you get the `dsh-rightclick-open` command; from the repo you can run:
//   node bin/dsh-rightclick-open.mjs status

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { install, uninstall, status } from '../lib/registry.js'

const execFileAsync = promisify(execFile)

// The subcommand the user typed: `dsh-rightclick-open install` → "install".
const [command] = process.argv.slice(2)

// When dsh runs the plugin we know dsh's path from the running process. This
// CLI runs standalone, so we look it up: an explicit env var first, otherwise
// `where dsh` → the npm shim (e.g. <npm dir>\dsh), whose sibling package dir
// holds the real JS entry:
//   <npm dir>\node_modules\@deepseek-ai\dsh\lib\bin.js
async function resolveDshCliPath() {
  if (process.env.DSH_CLI_PATH) return process.env.DSH_CLI_PATH
  try {
    const { stdout } = await execFileAsync('where', ['dsh'])
    const shim = stdout.trim().split(/\r?\n/)[0]
    const candidate = path.join(path.dirname(shim), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (existsSync(candidate)) return candidate
  } catch {
    /* fall through to the error below */
  }
  throw new Error(
    'Could not locate the dsh entry (lib/bin.js under the global @deepseek-ai/dsh package). ' +
    'Install it with `npm install -g @deepseek-ai/dsh` or set the DSH_CLI_PATH ' +
    'environment variable to the dsh bin.js path.'
  )
}

async function main() {
  switch (command) {
    case 'install': {
      const dshCliPath = await resolveDshCliPath()
      await install({ nodePath: process.execPath, dshCliPath })
      console.log('Right-click menu installed.')
      break
    }
    case 'uninstall':
      await uninstall()
      console.log('Right-click menu removed.')
      break
    case 'status': {
      const rows = await status()
      for (const row of rows) {
        console.log(`${row.installed ? 'installed' : 'missing'}  ${row.key}`)
      }
      break
    }
    default:
      console.log('Usage: dsh-rightclick-open <install|uninstall|status>')
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
