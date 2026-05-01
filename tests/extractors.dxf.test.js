/**
 * Unit tests for PE.Extractors.fromDxf() — synthetic DXF fixture parsing.
 */

const test   = require('node:test');
const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');
require('./helpers/load').loadAll();

const { fromDxf } = global.PE.Extractors;
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.dxf'), 'utf8');

test('fromDxf() parses TEXT entities and extracts dimensional facts', () => {
  const out = fromDxf(FIXTURE);
  assert.strictEqual(out.source, 'dxf');
  assert.ok(out.textEntities >= 3, 'expected at least 3 TEXT entities');
  assert.strictEqual(out.facts.doorWidthInches, 36);
  assert.strictEqual(out.facts.corridorWidthInches, 48);
  assert.strictEqual(out.facts.occupantLoad, 120);
});

test('fromDxf() reports layer set', () => {
  const out = fromDxf(FIXTURE);
  assert.ok(Array.isArray(out.layers));
  assert.ok(out.layers.length > 0);
});

test('fromDxf() infers feature flags from layer names', () => {
  const out = fromDxf(FIXTURE);
  assert.strictEqual(out.facts.hasSprinklers, true,  'SPRINKLER layer should set hasSprinklers');
  assert.strictEqual(out.facts.hasExitSigns,  true,  'A-EXIT-SIGN layer should set hasExitSigns');
});

test('fromDxf() handles malformed input without throwing', () => {
  const out = fromDxf('this is not a real dxf file');
  // Should degrade gracefully — return a result object, not throw.
  assert.strictEqual(out.source, 'dxf');
  assert.ok(out.facts && typeof out.facts === 'object');
});

test('fromDxf() returns LINE count from ENTITIES', () => {
  const out = fromDxf(FIXTURE);
  assert.ok(out.lineCount >= 2, 'expected at least 2 LINE entities');
});
