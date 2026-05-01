/**
 * Pipeline integration test.
 *
 * Mocks `fetch` (rule pack loader) and replaces `PE.Extractors.extract`
 * with a stub so we can assert the pipeline's step ordering and event
 * emission without spinning up a browser.
 */

const test   = require('node:test');
const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');

const loader = require('./helpers/load');
const { ROOT } = loader;

// Mock global fetch BEFORE loading pipeline.js so the loader picks it up.
global.fetch = function (url) {
  // Resolve URL to a real file under assets/data/rules
  const rel = url.replace(/^.*?assets\/data\/rules\//, 'assets/data/rules/');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.reject(new Error('not found')); } });
  }
  const body = fs.readFileSync(abs, 'utf8');
  return Promise.resolve({
    ok: true, status: 200,
    json: function () { return Promise.resolve(JSON.parse(body)); },
    text: function () { return Promise.resolve(body); }
  });
};

loader.loadAll();
loader.loadSource('assets/js/agent/pipeline.js');

const PE = global.PE;

test('Pipeline.STEPS exposes the expected 7-step list in order', () => {
  const ids = PE.Pipeline.STEPS.map(s => s.id);
  assert.deepStrictEqual(ids, ['ingest', 'classify', 'extract', 'select', 'evaluate', 'cite', 'draft']);
});

test('Pipeline.run() emits step events in correct order with mocked extractor', async () => {
  // Stub the extractor: return a fact bundle that triggers concrete findings.
  PE.Extractors.extract = async function (file, formData /*, onProgress */) {
    return {
      source: 'pdf',
      text: 'GROSS FLOOR AREA: 5000 sq ft\nOCCUPANT LOAD: 80\nCorridor width: 48 in',
      pageCount: 1,
      parseDurationMs: 1,
      fileMeta: { fileName: file.name, sizeBytes: file.size, mimeType: 'application/pdf', sha256: 'mock' },
      facts: {
        grossArea: 5000,
        occupantLoad: 80,
        corridorWidthInches: 48,
        numExits: 2,
        buildingType: formData.buildingType || 'Commercial',
        hasSprinklers: true
      }
    };
  };

  const events = [];
  const result = await PE.Pipeline.run(
    { name: 'mock.pdf', size: 1234, type: 'application/pdf', arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); } },
    { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'Phoenix', state: 'AZ' },
    function (stepId, status, detail) { events.push({ stepId, status, detail }); }
  );

  // Check ordering: every step should appear with running then done (in order)
  const order = ['ingest', 'classify', 'extract', 'select', 'evaluate', 'cite', 'draft'];
  const seenRunning = events.filter(e => e.status === 'running').map(e => e.stepId);
  const seenDone    = events.filter(e => e.status === 'done').map(e => e.stepId);
  assert.deepStrictEqual(seenRunning, order, 'each step must emit running once in order');
  // Every step that ran should also emit done (or error). Confirm done covers all.
  for (const id of order) {
    assert.ok(seenDone.includes(id) || events.some(e => e.stepId === id && e.status === 'error'),
      'step ' + id + ' must emit done or error');
  }

  assert.ok(typeof result.score === 'number', 'result.score should be numeric');
  assert.ok(Array.isArray(result.findings), 'result.findings should be an array');
  assert.ok(result.findings.length > 0, 'pipeline should produce at least one finding');
});

test('Pipeline.run() reports an error event when extractor throws', async () => {
  PE.Extractors.extract = async function () {
    throw new Error('boom');
  };
  const events = [];
  await assert.rejects(
    PE.Pipeline.run(
      { name: 'bad.pdf', size: 1, type: 'application/pdf', arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); } },
      { buildingType: 'Commercial', buildingCode: '2021 IBC' },
      function (stepId, status, detail) { events.push({ stepId, status, detail }); }
    ),
    /boom/
  );
  assert.ok(events.some(e => e.stepId === 'ingest' && e.status === 'error'),
    'ingest error must be emitted before throw');
});

test('Pipeline.run() short-circuits gracefully on unsupported file types', async () => {
  PE.Extractors.extract = async function (file) {
    return {
      source: 'unknown', text: '', facts: {},
      unsupported: true,
      unsupportedReason: 'Unsupported file type ".xyz".',
      fileMeta: { fileName: file.name, sizeBytes: file.size, mimeType: 'application/octet-stream', sha256: 'mock' }
    };
  };
  const events = [];
  const result = await PE.Pipeline.run(
    { name: 'thing.xyz', size: 10, type: 'application/octet-stream', arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); } },
    { buildingType: 'Commercial', buildingCode: '2021 IBC' },
    function (stepId, status, detail) { events.push({ stepId, status, detail }); }
  );
  // Pipeline should bail at ingest and not attempt classify/extract/etc.
  const ids = events.map(e => e.stepId);
  assert.ok(ids.includes('ingest'), 'ingest event emitted');
  assert.ok(!ids.includes('classify'), 'classify should not run for unsupported types');
  assert.match(result.summary || '', /Unsupported|cannot|not supported/i);
});
