import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.TEST_DASHBOARD_PORT || 3030;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Dynamic Test File Discovery ───────────────────────────────────────────────

function discoverTestFiles(dir, fileList = []) {
  const fullDir = path.join(__dirname, dir);
  if (!fs.existsSync(fullDir)) return fileList;
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      discoverTestFiles(relPath, fileList);
    } else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js')) {
      fileList.push(relPath);
    }
  }
  return fileList;
}

function extractTestCasesFromFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const tests = [];
    const regex = /(?:it|test)\s*\(\s*(['"`])((?:(?!\1).)+)\1/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[2].trim();
      if (name.length > 3 && name !== ';' && !name.startsWith(';') && !name.includes('split') && !name.includes('map')) {
        tests.push({ name, status: 'idle' });
      }
    }
    return tests;
  } catch (err) {
    return [];
  }
}

// ─── Feature Area Mapping ──────────────────────────────────────────────────────
// Maps test files to functional domain areas for the "by feature" view

const FEATURE_AREA_MAP = {
  'tests/frontend/auth.test.js':         'auth',
  'tests/frontend/praxen.test.js':       'startseite',
  'tests/frontend/store.test.js':        'startseite',
  'tests/backend/server_auth.test.js':   'auth',
  'tests/backend/server_dashboard.test.js': 'arzt_dashboard',
  'tests/backend/server_precheckin.test.js': 'precheckin',
  'tests/backend/server_termine.test.js': 'termine',
  'tests/e2e/precheckin.spec.js':        'precheckin',
  'tests/e2e/landing_filters.spec.js':   'startseite',
  'tests/e2e/patient_database.spec.js':  'arzt_dashboard',
};

const FEATURE_AREAS = {
  auth:            { label: '🔑 Authentifizierung & Praxis', order: 1 },
  startseite:      { label: '🏠 Startseite & Filter', order: 2 },
  arzt_dashboard:  { label: '🏥 Arzt-Dashboard & Warteschlange', order: 3 },
  precheckin:      { label: '📋 Pre-Check-In & Patienten', order: 4 },
  termine:         { label: '📅 Termine & Kalender', order: 5 },
};

function getCategory(filePath) {
  if (filePath.startsWith('tests/e2e/')) return 'e2e';
  if (filePath.startsWith('tests/backend/')) return 'integration';
  if (filePath.startsWith('tests/frontend/')) return 'unit';
  return 'unit';
}

function getArea(filePath) {
  return FEATURE_AREA_MAP[filePath] || 'startseite';
}

function getSuiteName(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const names = {
    'auth.test':             'Frontend Auth Utilities',
    'praxen.test':           'Frontend Doctor\'s Offices Data API',
    'store.test':            'Frontend Store & State',
    'server_auth.test':      'Backend Auth API',
    'server_dashboard.test': 'Backend Dashboard & Queue API',
    'server_precheckin.test': 'Backend Pre-Check-In API',
    'server_termine.test':   'Backend Termine & Health API',
    'precheckin.spec':       'Full Pre-Check-In & Doctor\'s Office Flow (Playwright E2E)',
    'landing_filters.spec':  'Landing Page Filter Tests (Playwright E2E)',
    'patient_database.spec': 'Patient Database Tests (Playwright E2E)',
  };
  return names[base] || base;
}

// ─── Build Test Suites Dynamically ─────────────────────────────────────────────

function buildTestSuites() {
  const allFiles = discoverTestFiles('tests');
  const suites = { unit: [], integration: [], e2e: [] };
  let idCounter = 0;

  allFiles.forEach(filePath => {
    const category = getCategory(filePath);
    const area = getArea(filePath);
    const tests = extractTestCasesFromFile(filePath);
    const prefix = category === 'unit' ? 'u' : (category === 'integration' ? 'i' : 'e');
    idCounter++;
    const id = `${prefix}${idCounter}`;

    suites[category].push({
      id,
      name: getSuiteName(filePath),
      file: filePath,
      category,
      area,
      tests,
      testCount: tests.length,
      status: 'idle',
      numPassed: 0,
      numFailed: 0,
      durationMs: 0,
    });
  });

  return suites;
}

let TEST_SUITES = buildTestSuites();

// ─── Test Run History ──────────────────────────────────────────────────────────

const HISTORY_FILE = path.join(__dirname, 'test_history.json');
let testHistory = [];

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      testHistory = JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not load test history:', err.message);
    testHistory = [];
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(testHistory, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save test history:', err.message);
  }
}

function recordRun(runData) {
  testHistory.unshift(runData); // newest first
  if (testHistory.length > 50) testHistory = testHistory.slice(0, 50); // keep max 50
  saveHistory();
}

loadHistory();

// ─── API Endpoints ─────────────────────────────────────────────────────────────

// Return metadata about available tests + feature areas
app.get('/api/tests/suites', (req, res) => {
  res.json({
    suites: TEST_SUITES,
    featureAreas: FEATURE_AREAS,
  });
});

// Return test run history
app.get('/api/tests/history', (req, res) => {
  res.json(testHistory);
});

// Clear test run history
app.delete('/api/tests/history/clear', (req, res) => {
  testHistory = [];
  saveHistory();
  res.json({ ok: true, message: 'History cleared.' });
});

// Run tests endpoint using Server-Sent Events (SSE) for real-time progress
app.get('/api/tests/run', async (req, res) => {
  const categoryFilter = req.query.category || 'all'; // 'all', 'unit', 'integration', 'e2e', or specific file

  let suitesToRun = [];
  if (categoryFilter === 'all') {
    suitesToRun = [...TEST_SUITES.unit, ...TEST_SUITES.integration, ...TEST_SUITES.e2e];
  } else if (categoryFilter === 'unit') {
    suitesToRun = [...TEST_SUITES.unit];
  } else if (categoryFilter === 'integration') {
    suitesToRun = [...TEST_SUITES.integration];
  } else if (categoryFilter === 'e2e') {
    suitesToRun = [...TEST_SUITES.e2e];
  } else {
    // Single file or suite ID
    const all = [...TEST_SUITES.unit, ...TEST_SUITES.integration, ...TEST_SUITES.e2e];
    suitesToRun = all.filter(s => s.file === categoryFilter || s.id === categoryFilter);
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const totalSuites = suitesToRun.length;
  const runStartTime = Date.now();
  sendEvent('start', { totalSuites, category: categoryFilter, suites: suitesToRun });

  let completedCount = 0;
  let overallPassed = 0;
  let overallFailed = 0;
  let totalDurationMs = 0;
  const suiteResults = [];

  for (let i = 0; i < suitesToRun.length; i++) {
    const suite = suitesToRun[i];
    const startTime = Date.now();

    sendEvent('suite_start', {
      suiteId: suite.id,
      file: suite.file,
      name: suite.name,
      category: suite.category,
      index: i + 1,
      total: totalSuites
    });

    try {
      const result = await runSingleSuite(suite);
      const durationMs = Date.now() - startTime;
      totalDurationMs += durationMs;

      completedCount++;
      if (result.status === 'passed') overallPassed++;
      else overallFailed++;

      const progressPercent = Math.round((completedCount / totalSuites) * 100);

      const suiteResult = {
        suiteId: suite.id,
        file: suite.file,
        name: suite.name,
        category: suite.category,
        area: suite.area,
        status: result.status,
        durationMs,
        numPassed: result.numPassed,
        numFailed: result.numFailed,
        numTotal: result.numTotal,
        tests: result.tests,
        rawOutput: result.rawOutput,
        progressPercent,
        completedCount,
        totalSuites
      };

      suiteResults.push(suiteResult);
      sendEvent('suite_complete', suiteResult);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      totalDurationMs += durationMs;

      completedCount++;
      overallFailed++;
      const progressPercent = Math.round((completedCount / totalSuites) * 100);

      const suiteResult = {
        suiteId: suite.id,
        file: suite.file,
        name: suite.name,
        category: suite.category,
        area: suite.area,
        status: 'failed',
        durationMs,
        numPassed: 0,
        numFailed: 1,
        numTotal: 1,
        tests: [{ name: 'Suite Execution', status: 'failed', errorMessage: err.message || String(err) }],
        rawOutput: err.stack || String(err),
        progressPercent,
        completedCount,
        totalSuites
      };

      suiteResults.push(suiteResult);
      sendEvent('suite_complete', suiteResult);
    }
  }

  const finishData = {
    totalSuites,
    completedCount,
    overallPassed,
    overallFailed,
    totalDurationMs,
    status: overallFailed === 0 ? 'passed' : 'failed'
  };

  // Record this run in history
  const totalTests = suiteResults.reduce((sum, s) => sum + (s.numTotal || 0), 0);
  const totalTestsPassed = suiteResults.reduce((sum, s) => sum + (s.numPassed || 0), 0);
  const totalTestsFailed = suiteResults.reduce((sum, s) => sum + (s.numFailed || 0), 0);
  const passRate = totalTests > 0 ? Math.round((totalTestsPassed / totalTests) * 100) : 0;

  recordRun({
    id: `run_${Date.now()}`,
    timestamp: new Date().toISOString(),
    category: categoryFilter,
    totalSuites: totalSuites,
    totalTests,
    totalTestsPassed,
    totalTestsFailed,
    passRate,
    durationMs: totalDurationMs,
    status: finishData.status,
    suites: suiteResults.map(s => ({
      name: s.name,
      file: s.file,
      category: s.category,
      area: s.area,
      status: s.status,
      numPassed: s.numPassed,
      numFailed: s.numFailed,
      numTotal: s.numTotal,
      durationMs: s.durationMs,
    })),
  });

  sendEvent('finish', finishData);
  res.end();
});

// Helper function to execute Vitest or Playwright for a single suite
function runSingleSuite(suite) {
  return new Promise((resolve) => {
    const isE2E = suite.category === 'e2e';
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';

    let args = [];
    if (isE2E) {
      args = ['playwright', 'test', suite.file, '--reporter=json'];
    } else {
      args = ['vitest', 'run', suite.file, '--reporter=json'];
    }

    const child = spawn(cmd, args, {
      cwd: __dirname,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      let status = code === 0 ? 'passed' : 'failed';
      let tests = [];
      let numPassed = 0;
      let numFailed = 0;
      let numTotal = 0;

      try {
        // Try parsing JSON output
        const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          if (isE2E) {
            // Playwright JSON format
            const parsePlaywrightSuite = (s) => {
              if (s.specs) {
                s.specs.forEach(spec => {
                  numTotal++;
                  const ok = spec.ok || (spec.tests && spec.tests.every(t => t.status === 'expected'));
                  if (ok) numPassed++;
                  else numFailed++;
                  tests.push({
                    name: spec.title,
                    status: ok ? 'passed' : 'failed',
                    errorMessage: !ok && spec.tests ? spec.tests.map(t => t.results?.[0]?.error?.message).join('\n') : null
                  });
                });
              }
              if (s.suites) {
                s.suites.forEach(parsePlaywrightSuite);
              }
            };

            if (parsed.suites) {
              parsed.suites.forEach(parsePlaywrightSuite);
            }
          } else {
            // Vitest JSON format
            if (parsed.testResults) {
              parsed.testResults.forEach(resFile => {
                if (resFile.assertionResults) {
                  resFile.assertionResults.forEach(assertion => {
                    numTotal++;
                    if (assertion.status === 'passed') numPassed++;
                    else numFailed++;
                    tests.push({
                      name: assertion.title || assertion.fullName,
                      status: assertion.status === 'passed' ? 'passed' : 'failed',
                      errorMessage: assertion.failureMessages ? assertion.failureMessages.join('\n') : null
                    });
                  });
                }
              });
            }
            if (numTotal === 0 && parsed.numTotalTests) {
              numTotal = parsed.numTotalTests;
              numPassed = parsed.numPassedTests || 0;
              numFailed = parsed.numFailedTests || 0;
            }
          }
        }
      } catch (e) {
        // Parsing failed fallback
      }

      if (numTotal === 0) {
        // Fallback if JSON parse didn't extract tests
        numTotal = 1;
        if (status === 'passed') numPassed = 1;
        else numFailed = 1;
        tests.push({
          name: suite.name,
          status,
          errorMessage: status === 'failed' ? stderrData || stdoutData : null
        });
      }

      resolve({
        status,
        numPassed,
        numFailed,
        numTotal,
        tests,
        rawOutput: stdoutData + '\n' + stderrData
      });
    });
  });
}

// Serve dashboard HTML at root and aliases
app.get(['/', '/test-dashboard', '/test-dashboard.html'], (req, res) => {
  res.sendFile('test-dashboard.html', { root: path.join(__dirname, 'public') });
});

app.listen(PORT, () => {
  const allSuites = [...TEST_SUITES.unit, ...TEST_SUITES.integration, ...TEST_SUITES.e2e];
  const totalTests = allSuites.reduce((sum, s) => sum + s.testCount, 0);
  console.log(`\n======================================================`);
  console.log(`  🧪 Test Dashboard Live on http://localhost:${PORT}`);
  console.log(`  📋 ${allSuites.length} Suiten mit ${totalTests} Tests entdeckt`);
  console.log(`  📜 ${testHistory.length} historische Testläufe geladen`);
  console.log(`======================================================\n`);
});
