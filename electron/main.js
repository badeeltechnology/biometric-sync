const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const { PythonBridge } = require('./python-bridge')

// Initialize encrypted store for secure config storage
const store = new Store({
  encryptionKey: 'biometric-sync-secure-key-2024',
  schema: {
    erpnext: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        apiKey: { type: 'string' },
        apiSecret: { type: 'string' },
        version: { type: 'number', default: 15 }
      }
    },
    syncFrequency: { type: 'number', default: 5 },
    autoStart: { type: 'boolean', default: false }
  }
})

let mainWindow = null
let tray = null
let pythonBridge = null
let syncInterval = null

// Use app.isPackaged as the primary check - it's reliable in Electron
const isDev = !app.isPackaged

function getIconPath() {
  // Try multiple icon formats in order of preference
  const iconNames = process.platform === 'win32'
    ? ['icon.ico', 'icon.png', 'icon.svg']
    : ['icon.png', 'icon.icns', 'icon.svg']

  const resourcesDir = isDev
    ? path.join(__dirname, '../resources')
    : path.join(process.resourcesPath, 'resources')

  for (const iconName of iconNames) {
    const iconPath = path.join(resourcesDir, iconName)
    if (fs.existsSync(iconPath)) {
      return iconPath
    }
  }

  // Fallback to resources in app directory
  const fallbackDir = path.join(__dirname, '../resources')
  for (const iconName of iconNames) {
    const iconPath = path.join(fallbackDir, iconName)
    if (fs.existsSync(iconPath)) {
      return iconPath
    }
  }

  return null
}

function getIndexPath() {
  if (isDev) {
    return null // Will use URL instead
  }

  // In production, check multiple possible locations
  const possiblePaths = [
    path.join(__dirname, '../dist/index.html'),
    path.join(process.resourcesPath, 'app/dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html')
  ]

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }

  console.error('Could not find index.html in any of:', possiblePaths)
  return possiblePaths[0] // Return first path for error message
}

function createWindow() {
  const iconPath = getIconPath()

  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false,
    backgroundColor: '#f8fafc'
  }

  // Only set icon if it exists
  if (iconPath) {
    windowOptions.icon = iconPath
  }

  // titleBarStyle is macOS specific
  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'
  }

  mainWindow = new BrowserWindow(windowOptions)

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = getIndexPath()

    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err)
      // Show error page
      mainWindow.loadURL(`data:text/html,
        <html>
          <head><title>Error</title></head>
          <body style="font-family: system-ui; padding: 40px; background: #f8fafc;">
            <h1 style="color: #ef4444;">Failed to load application</h1>
            <p>Could not find: ${indexPath}</p>
            <p>Error: ${err.message}</p>
            <p style="color: #6b7280; margin-top: 20px;">
              Please reinstall the application or contact support.
            </p>
          </body>
        </html>
      `)
    })
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = getIconPath()

  // Create tray icon - handle missing icon gracefully
  let icon
  if (iconPath && fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    // Create a simple colored icon as fallback
    icon = nativeImage.createEmpty()
  }

  // Skip tray creation if no valid icon on Windows
  if (icon.isEmpty() && process.platform === 'win32') {
    console.warn('Skipping tray creation: no valid icon found')
    return
  }

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Sync Now', click: () => triggerManualSync() },
    { label: 'Pause Sync', type: 'checkbox', checked: false, click: (item) => toggleSync(item.checked) },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true
      app.quit()
    }}
  ])

  tray.setToolTip('Biometric Attendance Sync')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => mainWindow.show())
}

async function initializePythonBridge() {
  pythonBridge = new PythonBridge()

  try {
    await pythonBridge.initialize()
    console.log('Python bridge initialized successfully')
    // Notify renderer that Python is ready
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('python:ready')
    }
  } catch (error) {
    console.error('Failed to initialize Python bridge:', error)

    const isPythonMissing = error.message.includes('Python 3 not found') ||
                            error.message.includes('not found') ||
                            error.message.includes('ENOENT')

    // Send error to renderer so it can show in UI
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('python:error', {
        message: error.message,
        isPythonMissing,
        downloadUrl: 'https://www.python.org/downloads/',
        instructions: process.platform === 'win32'
          ? [
              '1. Download Python 3.11 from python.org/downloads',
              '2. Run the installer',
              '3. IMPORTANT: Check "Add Python to PATH" during installation',
              '4. Restart this application',
              '5. If still not working, open Command Prompt and run:',
              '   pip install pyzk requests openpyxl reportlab schedule'
            ]
          : [
              '1. Install Python 3: brew install python3',
              '2. Install dependencies: pip3 install pyzk requests openpyxl reportlab schedule',
              '3. Restart this application'
            ]
      })
    }
  }
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
}

async function triggerManualSync() {
  if (pythonBridge) {
    try {
      mainWindow.webContents.send('sync:started')
      const result = await pythonBridge.call('run_sync', {})
      mainWindow.webContents.send('sync:completed', result)
      showNotification('Sync Complete', `Synced ${result.records_synced || 0} records`)
    } catch (error) {
      mainWindow.webContents.send('sync:error', error.message)
      showNotification('Sync Failed', error.message)
    }
  }
}

function toggleSync(paused) {
  if (paused && syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  } else if (!paused) {
    startAutoSync()
  }
}

function startAutoSync() {
  const frequency = store.get('syncFrequency', 5) * 60 * 1000 // Convert to milliseconds

  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(() => {
    triggerManualSync()
  }, frequency)
}

// IPC Handlers
function setupIpcHandlers() {
  // Config handlers
  ipcMain.handle('config:get', (event, key) => store.get(key))
  ipcMain.handle('config:set', (event, key, value) => store.set(key, value))
  ipcMain.handle('config:getAll', () => store.store)

  // Python bridge handlers
  ipcMain.handle('python:call', async (event, method, params) => {
    if (!pythonBridge) throw new Error('Python bridge not initialized')
    return await pythonBridge.call(method, params)
  })

  // Device handlers
  ipcMain.handle('devices:list', async () => {
    return await pythonBridge.call('get_devices', {})
  })

  ipcMain.handle('devices:add', async (event, device) => {
    return await pythonBridge.call('add_device', device)
  })

  ipcMain.handle('devices:update', async (event, device) => {
    return await pythonBridge.call('update_device', device)
  })

  ipcMain.handle('devices:delete', async (event, deviceId) => {
    return await pythonBridge.call('delete_device', { id: deviceId })
  })

  ipcMain.handle('devices:test', async (event, device) => {
    return await pythonBridge.call('test_device_connection', device)
  })

  // Sync handlers
  ipcMain.handle('sync:trigger', async () => {
    return await triggerManualSync()
  })

  ipcMain.handle('sync:status', async () => {
    return await pythonBridge.call('get_sync_status', {})
  })

  ipcMain.handle('sync:history', async (event, params) => {
    return await pythonBridge.call('get_sync_history', params)
  })

  ipcMain.handle('sync:logs', async (event, params) => {
    return await pythonBridge.call('get_attendance_logs', params)
  })

  // ERPNext handlers
  ipcMain.handle('erpnext:test', async (event, config) => {
    return await pythonBridge.call('test_erpnext_connection', config)
  })

  // Shift handlers
  ipcMain.handle('shifts:list', async () => {
    return await pythonBridge.call('get_shifts', {})
  })

  ipcMain.handle('shifts:add', async (event, shift) => {
    return await pythonBridge.call('add_shift', shift)
  })

  ipcMain.handle('shifts:update', async (event, shift) => {
    return await pythonBridge.call('update_shift', shift)
  })

  ipcMain.handle('shifts:delete', async (event, shiftId) => {
    return await pythonBridge.call('delete_shift', { id: shiftId })
  })

  // Export handlers
  ipcMain.handle('export:excel', async (event, params) => {
    return await pythonBridge.call('export_to_excel', params)
  })

  ipcMain.handle('export:pdf', async (event, params) => {
    return await pythonBridge.call('export_to_pdf', params)
  })
}

// Auto-updater setup
function setupAutoUpdater() {
  // Don't check for updates in development
  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update:available', info)
    }
    showNotification('Update Available', `Version ${info.version} is available. Click to download.`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available')
  })

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update:progress', progress)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded')
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update:downloaded', info)
    }
    showNotification('Update Ready', 'Restart the app to install the update.')
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error)
  })

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log('Update check failed:', err.message)
    })
  }, 5000)
}

// IPC handlers for updates
function setupUpdateHandlers() {
  // Open external URL in default browser
  ipcMain.handle('shell:openExternal', async (event, url) => {
    await shell.openExternal(url)
  })

  // Retry Python initialization
  ipcMain.handle('python:retry', async () => {
    await initializePythonBridge()
    return pythonBridge?.isInitialized || false
  })

  ipcMain.handle('update:check', async () => {
    if (isDev) return { updateAvailable: false }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { updateAvailable: !!result.updateInfo }
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

// App lifecycle
app.whenReady().then(async () => {
  createWindow()
  createTray()
  setupIpcHandlers()
  setupUpdateHandlers()
  await initializePythonBridge()
  setupAutoUpdater()

  // Start auto sync if enabled
  if (store.get('autoStart', false)) {
    startAutoSync()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (pythonBridge) {
    pythonBridge.terminate()
  }
  if (syncInterval) {
    clearInterval(syncInterval)
  }
})
