/**
 * Unit tests for PE.Extractors.parse() — the regex-driven fact extractor.
 *
 * Run with:  npm test
 *            (or)  node --test tests/extractors.parse.test.js
 */

const test   = require('node:test');
const assert = require('node:assert');
require('./helpers/load').loadAll();

const { parse } = global.PE.Extractors;

test('parse() extracts gross floor area', () => {
  const facts = parse('Project narrative\nGROSS FLOOR AREA: 12,500 sq ft');
  assert.strictEqual(facts.grossArea, 12500);
});

test('parse() extracts occupant load', () => {
  const facts = parse('Calculated occupant load: 320');
  assert.strictEqual(facts.occupantLoad, 320);
});

test('parse() extracts stair tread + riser', () => {
  const facts = parse('Stair tread: 11 in\nStair riser: 7 in');
  assert.strictEqual(facts.stairTreadDepthIn, 11);
  assert.strictEqual(facts.stairRiserHeightIn, 7);
});

test('parse() extracts corridor + door widths', () => {
  const facts = parse('Corridor width: 44 in\nDoor clear width: 36 in');
  assert.strictEqual(facts.corridorWidthInches, 44);
  assert.strictEqual(facts.doorWidthInches, 36);
});

test('parse() extracts building height (ft)', () => {
  const facts = parse('Building Height: 65 ft above grade');
  assert.strictEqual(facts.buildingHeightFt, 65);
});

test('parse() extracts fire separation distance', () => {
  const facts = parse('Fire separation distance: 12 ft');
  assert.strictEqual(facts.fireSeparationDistanceFt, 12);
});

test('parse() returns null for missing facts but sets bool flags', () => {
  const facts = parse('Empty document with no measurements.');
  assert.strictEqual(facts.grossArea, undefined);
  assert.strictEqual(facts.hasSprinklers, null);
  assert.strictEqual(facts.hasFireAlarm,  null);
});

test('parse() detects hasSprinklers truthy', () => {
  const facts = parse('Building protected by automatic sprinkler system per NFPA 13.');
  assert.strictEqual(facts.hasSprinklers, true);
});

test('parse() detects hasSprinklers falsy', () => {
  const facts = parse('No sprinkler system installed.');
  assert.strictEqual(facts.hasSprinklers, false);
});

test('parse() detects hasHandrails', () => {
  const facts = parse('Handrails on both sides of stair.');
  assert.strictEqual(facts.hasHandrails, true);
});

test('parse() handles missing / null text gracefully', () => {
  const f1 = parse('');
  const f2 = parse(null);
  assert.strictEqual(f1.grossArea, undefined);
  assert.strictEqual(f2.grossArea, undefined);
});
