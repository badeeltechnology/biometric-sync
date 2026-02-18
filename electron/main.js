const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron')
const path = require('path')
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

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '../resources/icon.png'),
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8fafc'
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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
  const iconPath = path.join(__dirname, '../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

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
  } catch (error) {
    console.error('Failed to initialize Python bridge:', error)
    showNotification('Error', 'Failed to initialize Python backend')
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

// App lifecycle
app.whenReady().then(async () => {
  createWindow()
  createTray()
  setupIpcHandlers()
  await initializePythonBridge()

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
