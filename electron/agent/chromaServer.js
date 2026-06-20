const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = Number(process.env.CHROMA_PORT || 8000);
const AUTO_START = process.env.CHROMA_AUTO_START !== 'false';

let chromaProcess = null;
let startedByApp = false;

function getChromaDataPath(app) {
  if (process.env.CHROMA_DATA_PATH) {
    return process.env.CHROMA_DATA_PATH;
  }

  if (app) {
    return path.join(app.getPath('userData'), 'chroma-data');
  }

  return path.join(process.cwd(), 'chroma-data');
}

function getChromaBaseUrl() {
  return `http://${CHROMA_HOST}:${CHROMA_PORT}`;
}

async function isChromaRunning() {
  try {
    const response = await fetch(`${getChromaBaseUrl()}/api/v2/heartbeat`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForChroma(maxAttempts = 40, intervalMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isChromaRunning()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}

async function startChromaServer(app) {
  if (!AUTO_START) {
    console.log('Chroma auto-start disabled (CHROMA_AUTO_START=false)');
    return { started: false, reason: 'auto-start-disabled' };
  }

  if (await isChromaRunning()) {
    console.log('Chroma already running');
    return { started: false, alreadyRunning: true };
  }

  const dataPath = getChromaDataPath(app);
  fs.mkdirSync(dataPath, { recursive: true });

  const chromaCli = path.join(__dirname, '../../node_modules/chromadb/dist/cli.mjs');
  chromaProcess = spawn(process.execPath, [
    chromaCli,
    'run',
    '--path',
    dataPath,
    '--host',
    CHROMA_HOST,
    '--port',
    String(CHROMA_PORT),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  startedByApp = true;

  chromaProcess.stdout?.on('data', chunk => {
    console.log(`[chroma] ${String(chunk).trim()}`);
  });

  chromaProcess.stderr?.on('data', chunk => {
    console.error(`[chroma] ${String(chunk).trim()}`);
  });

  chromaProcess.on('exit', code => {
    console.log(`Chroma process exited with code ${code}`);
    chromaProcess = null;
    startedByApp = false;
  });

  const ready = await waitForChroma();
  if (!ready) {
    console.error('Chroma failed to start within timeout');
    stopChromaServer();
    return { started: false, error: 'startup-timeout' };
  }

  console.log(`Chroma started at ${getChromaBaseUrl()} (data: ${dataPath})`);
  return { started: true, dataPath };
}

function stopChromaServer() {
  if (chromaProcess && startedByApp) {
    chromaProcess.kill();
    chromaProcess = null;
    startedByApp = false;
  }
}

module.exports = {
  startChromaServer,
  stopChromaServer,
  isChromaRunning,
  getChromaDataPath,
  getChromaBaseUrl,
};
