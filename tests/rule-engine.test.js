/**
 * Unit tests for PE.RuleEngine.evaluate() — facts → findings.
 *
 * Uses a small synthetic rule pack so we don't depend on the production
 * IBC/ADA/NFPA packs (which can drift in size/shape over time).
 */

const test   = require('node:test');
const assert = require('node:assert');
require('./helpers/load').loadAll();

const { evaluate, score } = global.PE.RuleEngine;

const PACK = {
  id: 'test-pack',
  name: 'Test Pack',
  rules: [
    {
      id: 'TEST-EGRESS',
      code_section: 'TEST §1',
      label: 'Egress width minimum',
      applies_to: ['Commercial'],
      check_fn: 'egress_width',
      parameters: { min_inches: 36, corridor_min_inches: 44, stair_min_inches: 44 }
    },
    {
      id: 'TEST-EXITS',
      code_section: 'TEST §2',
      label: 'Number of exits',
      applies_to: ['Commercial'],
      check_fn: 'num_exits',
      parameters: {}
    },
    {
      id: 'TEST-DOOR',
      code_section: 'TEST §3',
      label: 'Door width',
      applies_to: ['Commercial'],
      check_fn: 'door_width',
      parameters: { min_clear_in: 32 }
    },
    {
      id: 'TEST-DISABLED',
      code_section: 'TEST §X',
      label: 'Disabled rule',
      applies_to: ['Commercial'],
      check_fn: 'manual',
      disabled: true
    },
    {
      id: 'TEST-RES-ONLY',
      code_section: 'TEST §4',
      label: 'Residential-only',
      applies_to: ['Residential'],
      check_fn: 'manual'
    }
  ]
};

test('evaluate() flags egress width below minimum', () => {
  const facts = { corridorWidthInches: 30, occupantLoad: 100, numExits: 2 };
  const findings = evaluate(facts, [PACK], 'Commercial');
  const egress = findings.find(f => f.id === 'TEST-EGRESS');
  assert.ok(egress, 'expected egress finding');
  assert.strictEqual(egress.status, 'FLAGGED');
});

test('evaluate() passes egress width at/above minimum', () => {
  const facts = { corridorWidthInches: 48, occupantLoad: 100, numExits: 2 };
  const findings = evaluate(facts, [PACK], 'Commercial');
  const egress = findings.find(f => f.id === 'TEST-EGRESS');
  assert.strictEqual(egress.status, 'PASS');
});

test('evaluate() flags too few exits for occupant load', () => {
  const facts = { occupantLoad: 600, numExits: 2 };
  const findings = evaluate(facts, [PACK], 'Commercial');
  const ex = findings.find(f => f.id === 'TEST-EXITS');
  assert.strictEqual(ex.status, 'FLAGGED');
});

test('evaluate() returns REVIEW when key fact is missing', () => {
  const facts = {};   // nothing extracted
  const findings = evaluate(facts, [PACK], 'Commercial');
  const egress = findings.find(f => f.id === 'TEST-EGRESS');
  assert.strictEqual(egress.status, 'REVIEW');
});

test('evaluate() skips disabled rules and applies_to mismatches', () => {
  const findings = evaluate({ doorWidthInches: 36 }, [PACK], 'Commercial');
  assert.ok(!findings.find(f => f.id === 'TEST-DISABLED'),  'disabled rule should be skipped');
  assert.ok(!findings.find(f => f.id === 'TEST-RES-ONLY'),  'residential-only rule should be skipped for Commercial');
});

test('score() returns 100 when no findings', () => {
  assert.strictEqual(score([]), 100);
});

test('score() decreases with FLAGGED findings', () => {
  const passOnly  = [{ status: 'PASS',    severity: 'high' }];
  const flagged   = [{ status: 'FLAGGED', severity: 'critical' }];
  assert.strictEqual(score(passOnly), 100);
  assert.ok(score(flagged) < 50, 'flagged critical should drop score significantly');
});
