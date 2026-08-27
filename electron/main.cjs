const { app, BrowserWindow, shell, ipcMain, Menu, Notification, dialog } = require('electron');
const path = require('path');
const url = require('url');

// Prevent multiple instances of the app from running concurrently
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the existing window if user attempts to launch a second one
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit BUKKIT' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'BUKKIT Online Portal',
          click: async () => {
            await shell.openExternal('https://buk-kit.web.app');
          }
        },
        {
          label: 'Documentation & GitHub',
          click: async () => {
            await shell.openExternal('https://github.com');
          }
        },
        { type: 'separator' },
        {
          label: 'About BUKKIT Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About BUKKIT Desktop',
              message: 'BUKKIT — Campus Food Marketplace',
              detail: `Version: ${app.getVersion()}\nPlatform: ${process.platform} (${process.arch})\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChromium: ${process.versions.chrome}\n\nFast, reliable Nigerian university food ordering & delivery desktop application.`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'BUKKIT — Campus Food Marketplace',
    backgroundColor: '#0D472B',
    show: false, // Smooth visual show when ready
    icon: path.join(__dirname, '../public/bukkit-icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      spellcheck: true
    }
  });

  createApplicationMenu();

  // Load URL based on environment
  if (isDev && process.env.ELECTRON_START_URL) {
    console.log(`[Electron] Loading Dev Server: ${devServerUrl}`);
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log(`[Electron] Loading Production Build: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch(() => {
      // Fallback url loader
      mainWindow.loadURL(
        url.format({
          pathname: indexPath,
          protocol: 'file:',
          slashes: true
        })
      );
    });
  }

  // Gracefully show window once ready-to-show to eliminate white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external web links (e.g. payment portals, external directions) safely
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    // Open external protocols (http/https outside localhost) in user default browser
    if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      // Allow navigation within localhost in dev mode
      if (isDev && parsedUrl.host === new URL(devServerUrl).host) {
        return;
      }
      // Otherwise open externally
      if (!isDev && parsedUrl.protocol !== 'file:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -----------------------------------------------------------------------------
// IPC Communication Handlers
// -----------------------------------------------------------------------------
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-platform', () => process.platform);
ipcMain.handle('app:get-arch', () => process.arch);

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('system:show-notification', (event, { title, body, icon }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || 'BUKKIT Campus Food',
      body: body || '',
      icon: icon || path.join(__dirname, '../public/bukkit-icon.svg')
    });
    notification.show();
  }
});

ipcMain.on('system:open-external', async (event, externalUrl) => {
  if (externalUrl && typeof externalUrl === 'string') {
    await shell.openExternal(externalUrl);
  }
});

// -----------------------------------------------------------------------------
// Application Lifecycle
// -----------------------------------------------------------------------------
app.whenReady().then(() => {
  // Set Application User Model ID for Windows toast notifications
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.faratech.bukkit.desktop');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
