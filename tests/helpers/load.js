/**
 * Test loader for Plan-Examiner browser modules.
 *
 * The production code is plain `<script>`-tag JS that attaches to
 * `window.PE`. To exercise it under `node --test`, we install a minimal
 * `window` polyfill on `global`, then evaluate each source file in the
 * shared global scope. After loading, modules are reachable as
 * `global.PE.Extractors`, `global.PE.RuleEngine`, etc.
 */

const fs   = require('node:fs');
const path = require('node:path');
const vm   = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

if (!global.window)     global.window     = global;
if (!global.PE)         global.PE         = {};
if (!global.localStorage) {
  const _store = {};
  global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
    setItem: function (k, v) { _store[k] = String(v); },
    removeItem: function (k) { delete _store[k]; },
    clear: function () { for (const k of Object.keys(_store)) delete _store[k]; }
  };
}
if (!global.crypto) {
  try { global.crypto = require('node:crypto').webcrypto; } catch (e) { /* ignore */ }
}
if (!global.navigator)  global.navigator  = { userAgent: 'node-test' };
if (!global.performance) global.performance = { now: function () { return Date.now(); } };
if (!global.TextDecoder) global.TextDecoder = require('node:util').TextDecoder;

function loadSource(relPath) {
  const abs = path.join(ROOT, relPath);
  const src = fs.readFileSync(abs, 'utf8');
  vm.runInThisContext(src, { filename: abs });
}

function loadAll() {
  loadSource('assets/js/utils/log.js');
  loadSource('assets/js/agent/rule-engine.js');
  loadSource('assets/js/agent/extractors.js');
}

module.exports = { loadSource, loadAll, ROOT };
