// Electron entry point: serves the static Next.js export over http://localhost so the
// RuneLite WikiSync plugin (which only accepts the "localhost" origin) can connect.
const {
  app, BrowserWindow, Menu, dialog, shell,
} = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

// Fixed port: saved loadouts live in IndexedDB, which is keyed by origin (including port).
// Kept outside WikiSync's 37767-37776 range.
const PORT = 37780;
const BASE_PATH = '/osrs-dps';
const APP_URL = `http://localhost:${PORT}${BASE_PATH}`;
const ROOT = path.join(__dirname, 'app');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const resolveFile = (url) => {
  let urlPath = decodeURIComponent(url.split('?')[0]);
  if (urlPath === BASE_PATH) {
    urlPath = '/';
  } else if (urlPath.startsWith(`${BASE_PATH}/`)) {
    urlPath = urlPath.slice(BASE_PATH.length);
  } else {
    return null;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep)) return null;
  for (const candidate of [file, `${file}.html`]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};

const handleRequest = (req, res) => {
  if (req.url === '/' || req.url === '') {
    res.writeHead(302, { Location: `${BASE_PATH}/` });
    res.end();
    return;
  }
  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
};

// Chromium may resolve "localhost" to either loopback address, so listen on both.
const startServer = () => new Promise((resolve, reject) => {
  const v4 = http.createServer(handleRequest);
  v4.once('error', reject);
  v4.listen(PORT, '127.0.0.1', () => {
    const v6 = http.createServer(handleRequest);
    v6.once('error', () => {}); // IPv6 loopback is optional
    v6.listen(PORT, '::1');
    resolve();
  });
});

let mainWindow;

// Small JSON settings file in %APPDATA%\DPS Calc (survives rebuilds of the exe).
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

const loadSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
};

const saveSettings = (changes) => {
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), ...changes }, null, 2));
};

// Same zoom steps as Chrome.
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const setZoom = (factor) => {
  if (!mainWindow) return;
  const clamped = Math.min(Math.max(factor, ZOOM_STEPS[0]), ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  mainWindow.webContents.setZoomFactor(clamped);
  saveSettings({ zoomFactor: clamped });
};

const stepZoom = (direction) => {
  if (!mainWindow) return;
  const current = mainWindow.webContents.getZoomFactor();
  const next = direction > 0
    ? ZOOM_STEPS.find((z) => z > current + 0.001)
    : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
  if (next) setZoom(next);
};

// Shown when pressing Alt (the menu bar is hidden by default).
const buildMenu = () => Menu.buildFromTemplate([
  {
    label: 'View',
    submenu: [
      // Shortcuts are handled in before-input-event so Ctrl+Shift+= and the numpad also work.
      {
        label: 'Zoom In', accelerator: 'CmdOrCtrl+=', registerAccelerator: false, click: () => stepZoom(1),
      },
      {
        label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', registerAccelerator: false, click: () => stepZoom(-1),
      },
      {
        label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', registerAccelerator: false, click: () => setZoom(1),
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'togglefullscreen' },
      { role: 'toggleDevTools', accelerator: 'F12' },
    ],
  },
]);

const isAppUrl = (url) => url === APP_URL || url.startsWith(`${APP_URL}/`) || url.startsWith(`${APP_URL}?`);

const openExternal = (url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 800,
    minHeight: 600,
    title: 'DPS Calculator',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#1b1612',
    autoHideMenuBar: true,
  });

  // Wiki, Discord, etc. links open in the normal browser instead of inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Ctrl + =/+/-/0, including numpad keys.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt) return;
    if (input.key === '=' || input.key === '+') {
      stepZoom(1);
    } else if (input.key === '-' || input.key === '_') {
      stepZoom(-1);
    } else if (input.key === '0' || input.key === ')') {
      setZoom(1);
    } else {
      return;
    }
    event.preventDefault();
  });

  // Ctrl + mouse wheel.
  mainWindow.webContents.on('zoom-changed', (event, direction) => {
    stepZoom(direction === 'in' ? 1 : -1);
  });

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.setZoomFactor(loadSettings().zoomFactor || 1);
  });

  mainWindow.loadURL(`${APP_URL}/`);
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
    } catch (e) {
      dialog.showErrorBox('DPS Calculator', `Could not start on port ${PORT}: ${e.message}\n\nSomething else is using that port.`);
      app.quit();
      return;
    }
    Menu.setApplicationMenu(buildMenu());
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
