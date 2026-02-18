const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),
  getAllConfig: () => ipcRenderer.invoke('config:getAll'),

  // Python bridge (generic)
  pythonCall: (method, params) => ipcRenderer.invoke('python:call', method, params),

  // Devices
  getDevices: () => ipcRenderer.invoke('devices:list'),
  addDevice: (device) => ipcRenderer.invoke('devices:add', device),
  updateDevice: (device) => ipcRenderer.invoke('devices:update', device),
  deleteDevice: (deviceId) => ipcRenderer.invoke('devices:delete', deviceId),
  testDevice: (device) => ipcRenderer.invoke('devices:test', device),

  // Sync
  triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  getSyncHistory: (params) => ipcRenderer.invoke('sync:history', params),
  getAttendanceLogs: (params) => ipcRenderer.invoke('sync:logs', params),

  // ERPNext
  testERPNext: (config) => ipcRenderer.invoke('erpnext:test', config),

  // Shifts
  getShifts: () => ipcRenderer.invoke('shifts:list'),
  addShift: (shift) => ipcRenderer.invoke('shifts:add', shift),
  updateShift: (shift) => ipcRenderer.invoke('shifts:update', shift),
  deleteShift: (shiftId) => ipcRenderer.invoke('shifts:delete', shiftId),

  // Export
  exportToExcel: (params) => ipcRenderer.invoke('export:excel', params),
  exportToPDF: (params) => ipcRenderer.invoke('export:pdf', params),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Event listeners
  onSyncStarted: (callback) => {
    ipcRenderer.on('sync:started', callback)
    return () => ipcRenderer.removeListener('sync:started', callback)
  },
  onSyncCompleted: (callback) => {
    ipcRenderer.on('sync:completed', (event, data) => callback(data))
    return () => ipcRenderer.removeListener('sync:completed', callback)
  },
  onSyncError: (callback) => {
    ipcRenderer.on('sync:error', (event, error) => callback(error))
    return () => ipcRenderer.removeListener('sync:error', callback)
  },
  onSyncProgress: (callback) => {
    ipcRenderer.on('sync:progress', (event, data) => callback(data))
    return () => ipcRenderer.removeListener('sync:progress', callback)
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Python status
  retryPython: () => ipcRenderer.invoke('python:retry'),
  onPythonReady: (callback) => {
    ipcRenderer.on('python:ready', callback)
    return () => ipcRenderer.removeListener('python:ready', callback)
  },
  onPythonError: (callback) => {
    ipcRenderer.on('python:error', (event, error) => callback(error))
    return () => ipcRenderer.removeListener('python:error', callback)
  },

  // Update events
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (event, info) => callback(info))
    return () => ipcRenderer.removeListener('update:available', callback)
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:progress', (event, progress) => callback(progress))
    return () => ipcRenderer.removeListener('update:progress', callback)
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update:downloaded', (event, info) => callback(info))
    return () => ipcRenderer.removeListener('update:downloaded', callback)
  }
})
