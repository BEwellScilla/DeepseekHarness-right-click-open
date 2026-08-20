// test/registry.test.js
// Unit tests for the *pure* parts of lib/registry.js. We never touch the real
// registry here — we only check that the strings we build are correct.
// Run with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildShellCommand, MENU_LABEL, TARGETS } from '../lib/registry.js'

test('buildShellCommand quotes paths and keeps the folder placeholder', () => {
  const cmd = buildShellCommand({
    nodePath: 'C:/Program Files/nodejs/node.exe',
    dshCliPath: 'C:/npm-global/node_modules/@deepseek-ai/dsh/lib/bin.js',
    folderVar: '%V',
    mode: 'web',
  })
  assert.equal(
    cmd,
    'cmd /k cd /d "%V" && "C:/Program Files/nodejs/node.exe" ' +
      '"C:/npm-global/node_modules/@deepseek-ai/dsh/lib/bin.js" web'
  )
})

test('right-click menu is registered for a folder background and a folder icon', () => {
  assert.deepEqual(
    TARGETS.map((t) => t.key),
    [
      'HKCU\\Software\\Classes\\Directory\\Background\\shell\\dsh-open-here',
      'HKCU\\Software\\Classes\\Directory\\shell\\dsh-open-here',
    ]
  )
})

test('the menu label is the friendly string users see', () => {
  assert.equal(MENU_LABEL, 'Open DeepSeek Harness here')
})
