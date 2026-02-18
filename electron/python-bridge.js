const { PythonShell } = require('python-shell')
const path = require('path')
const { app } = require('electron')

class PythonBridge {
  constructor() {
    this.pythonProcess = null
    this.pendingRequests = new Map()
    this.requestId = 0
    this.isInitialized = false
  }

  getPythonPath() {
    // In development, use system Python
    if (!app.isPackaged) {
      return process.platform === 'win32' ? 'python' : 'python3'
    }

    // In production, use bundled Python
    const resourcesPath = process.resourcesPath
    if (process.platform === 'win32') {
      return path.join(resourcesPath, 'python', 'python.exe')
    } else if (process.platform === 'darwin') {
      return path.join(resourcesPath, 'python', 'bin', 'python3')
    } else {
      return path.join(resourcesPath, 'python', 'bin', 'python3')
    }
  }

  getScriptPath() {
    if (!app.isPackaged) {
      return path.join(__dirname, '..', 'python', 'main.py')
    }
    return path.join(process.resourcesPath, 'python', 'main.py')
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const options = {
        mode: 'json',
        pythonPath: this.getPythonPath(),
        scriptPath: path.dirname(this.getScriptPath()),
        args: []
      }

      try {
        this.pythonProcess = new PythonShell('main.py', options)

        this.pythonProcess.on('message', (message) => {
          this.handleMessage(message)
        })

        this.pythonProcess.on('error', (error) => {
          console.error('Python error:', error)
        })

        this.pythonProcess.on('close', () => {
          console.log('Python process closed')
          this.isInitialized = false
        })

        // Send initialization command
        this.call('initialize', {})
          .then(() => {
            this.isInitialized = true
            resolve()
          })
          .catch(reject)

      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)
      this.pendingRequests.delete(message.id)

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'))
      } else {
        resolve(message.result)
      }
    }
  }

  async call(method, params = {}) {
    if (!this.pythonProcess) {
      throw new Error('Python process not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId

      this.pendingRequests.set(id, { resolve, reject })

      // Set timeout for request
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 60000) // 60 second timeout

      // Clear timeout on response
      const originalResolve = resolve
      const originalReject = reject

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout)
          originalResolve(result)
        },
        reject: (error) => {
          clearTimeout(timeout)
          originalReject(error)
        }
      })

      // Send request to Python
      this.pythonProcess.send({ method, params, id })
    })
  }

  terminate() {
    if (this.pythonProcess) {
      this.pythonProcess.kill()
      this.pythonProcess = null
    }
    this.isInitialized = false
    this.pendingRequests.clear()
  }
}

module.exports = { PythonBridge }
