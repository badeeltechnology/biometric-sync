const { PythonShell } = require('python-shell')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { execSync } = require('child_process')

class PythonBridge {
  constructor() {
    this.pythonProcess = null
    this.pendingRequests = new Map()
    this.requestId = 0
    this.isInitialized = false
  }

  findSystemPython() {
    // Common Python executable names to try
    const pythonCommands = process.platform === 'win32'
      ? ['python', 'python3', 'py']
      : ['python3', 'python']

    for (const cmd of pythonCommands) {
      try {
        // Test if the command works
        const result = execSync(`${cmd} --version`, {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true
        })
        if (result.includes('Python 3')) {
          console.log(`Found Python: ${cmd} -> ${result.trim()}`)
          return cmd
        }
      } catch (e) {
        // Command not found, try next
      }
    }

    // On Windows, try common installation paths
    if (process.platform === 'win32') {
      const commonPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
        'C:\\Python39\\python.exe',
        path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe'),
      ]

      for (const pythonPath of commonPaths) {
        if (fs.existsSync(pythonPath)) {
          console.log(`Found Python at: ${pythonPath}`)
          return pythonPath
        }
      }
    }

    throw new Error('Python 3 not found. Please install Python 3.9 or later from https://www.python.org/downloads/ and ensure it is added to PATH.')
  }

  getPythonPath() {
    // In development, use system Python
    if (!app.isPackaged) {
      return this.findSystemPython()
    }

    // In production, check for bundled Python runtime
    const resourcesPath = process.resourcesPath

    // Possible bundled Python locations (in order of preference)
    const bundledPaths = []

    if (process.platform === 'win32') {
      // Windows: Check python-runtime (bundled) first, then python folder
      bundledPaths.push(
        path.join(resourcesPath, 'python-runtime', 'python.exe'),
        path.join(resourcesPath, 'python', 'python.exe')
      )
    } else if (process.platform === 'darwin') {
      bundledPaths.push(
        path.join(resourcesPath, 'python-runtime', 'bin', 'python3'),
        path.join(resourcesPath, 'python', 'bin', 'python3')
      )
    } else {
      bundledPaths.push(
        path.join(resourcesPath, 'python-runtime', 'bin', 'python3'),
        path.join(resourcesPath, 'python', 'bin', 'python3')
      )
    }

    // Try each bundled Python path
    for (const bundledPython of bundledPaths) {
      if (fs.existsSync(bundledPython)) {
        console.log(`Using bundled Python: ${bundledPython}`)
        return bundledPython
      }
    }

    // Fallback to system Python
    console.log('Bundled Python not found, falling back to system Python')
    return this.findSystemPython()
  }

  getScriptPath() {
    if (!app.isPackaged) {
      return path.join(__dirname, '..', 'python', 'main.py')
    }

    // Check multiple possible locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'python', 'main.py'),
      path.join(app.getAppPath(), 'python', 'main.py'),
    ]

    for (const scriptPath of possiblePaths) {
      if (fs.existsSync(scriptPath)) {
        return scriptPath
      }
    }

    return possiblePaths[0]
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      let pythonPath
      try {
        pythonPath = this.getPythonPath()
      } catch (error) {
        reject(error)
        return
      }

      const scriptPath = this.getScriptPath()
      console.log(`Initializing Python bridge:`)
      console.log(`  Python: ${pythonPath}`)
      console.log(`  Script: ${scriptPath}`)

      if (!fs.existsSync(scriptPath)) {
        reject(new Error(`Python script not found: ${scriptPath}`))
        return
      }

      const options = {
        mode: 'json',
        pythonPath: pythonPath,
        scriptPath: path.dirname(scriptPath),
        args: []
      }

      try {
        this.pythonProcess = new PythonShell('main.py', options)

        this.pythonProcess.on('message', (message) => {
          this.handleMessage(message)
        })

        this.pythonProcess.on('stderr', (stderr) => {
          console.error('Python stderr:', stderr)
        })

        this.pythonProcess.on('error', (error) => {
          console.error('Python process error:', error)
          // Reject pending requests on error
          for (const [id, { reject: rejectFn }] of this.pendingRequests) {
            rejectFn(new Error(`Python process error: ${error.message}`))
          }
          this.pendingRequests.clear()
        })

        this.pythonProcess.on('close', (code) => {
          console.log(`Python process closed with code: ${code}`)
          this.isInitialized = false
          // Reject any pending requests
          for (const [id, { reject: rejectFn }] of this.pendingRequests) {
            rejectFn(new Error('Python process closed unexpectedly'))
          }
          this.pendingRequests.clear()
        })

        // Send initialization command with timeout
        const initTimeout = setTimeout(() => {
          reject(new Error('Python initialization timeout - Python may not be responding'))
        }, 30000)

        this.call('initialize', {})
          .then(() => {
            clearTimeout(initTimeout)
            this.isInitialized = true
            resolve()
          })
          .catch((err) => {
            clearTimeout(initTimeout)
            reject(err)
          })

      } catch (error) {
        reject(new Error(`Failed to start Python process: ${error.message}`))
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
