// lib/index.js
// The DeepSeek Harness plugin entry point.
//
// DSH loads your package's "main" file and looks for named exports:
//   name  – the plugin's id (used in logs / management UI)
//   apply – called with the Cordis context `ctx` when the plugin loads
//   inject – (optional) names of DSH services this plugin needs; we need none
//
// Real DSH host plugins do their work directly inside `apply` — they don't
// wait for a "ready" event — so we kick off the install immediately.
// `ctx.logger('namespace')` returns a scoped logger to use for messages.

import { install } from './registry.js'

export const name = 'dsh-rightclick-open'

export function apply(ctx) {
  const logger = ctx.logger('dsh-rightclick')

  install({
    // node.exe running this very process.
    nodePath: process.execPath,
    // The dsh script that started this process — the same CLI the menu
    // should launch. Using it means no PATH guessing inside Explorer.
    dshCliPath: process.argv[1],
  })
    .then(() => logger.info('Right-click "Open DeepSeek Harness here" menu installed.'))
    .catch((err) => logger.warn(`Could not install the right-click menu: ${err.message}`))
}
