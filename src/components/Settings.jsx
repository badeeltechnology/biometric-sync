import React, { useState, useEffect } from 'react'
import {
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Server,
  Key,
  Clock,
  Globe
} from 'lucide-react'

const ERPNEXT_VERSIONS = [
  { value: 12, label: 'Version 12' },
  { value: 13, label: 'Version 13' },
  { value: 14, label: 'Version 14' },
  { value: 15, label: 'Version 15 (LTS)' },
  { value: 16, label: 'Version 16' }
]

export default function SettingsPage() {
  const [config, setConfig] = useState({
    url: '',
    apiKey: '',
    apiSecret: '',
    version: 15
  })
  const [syncFrequency, setSyncFrequency] = useState(5)
  const [autoStart, setAutoStart] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const erpnext = await window.electronAPI?.getConfig('erpnext') || {}
      const freq = await window.electronAPI?.getConfig('syncFrequency') || 5
      const auto = await window.electronAPI?.getConfig('autoStart') || false

      setConfig({
        url: erpnext.url || '',
        apiKey: erpnext.apiKey || '',
        apiSecret: erpnext.apiSecret || '',
        version: erpnext.version || 15
      })
      setSyncFrequency(freq)
      setAutoStart(auto)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const handleConfigChange = (e) => {
    const { name, value } = e.target
    setConfig(prev => ({ ...prev, [name]: value }))
    setSaved(false)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI?.testERPNext({
        url: config.url,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        version: parseInt(config.version)
      })

      setTestResult({
        success: true,
        message: `Connected successfully! Site: ${result.site_name || config.url}`
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message || 'Connection failed'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      await window.electronAPI?.setConfig('erpnext', {
        url: config.url,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        version: parseInt(config.version)
      })
      await window.electronAPI?.setConfig('syncFrequency', syncFrequency)
      await window.electronAPI?.setConfig('autoStart', autoStart)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure ERPNext connection and sync options</p>
      </div>

      {/* ERPNext Configuration */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <Server className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">ERPNext Connection</h2>
            <p className="text-sm text-gray-500">Connect to your ERPNext/HRMS instance</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">ERPNext URL</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                name="url"
                value={config.url}
                onChange={handleConfigChange}
                className="input pl-10"
                placeholder="https://your-site.erpnext.com"
              />
            </div>
          </div>

          <div>
            <label className="label">API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="apiKey"
                value={config.apiKey}
                onChange={handleConfigChange}
                className="input pl-10"
                placeholder="Enter your API key"
              />
            </div>
          </div>

          <div>
            <label className="label">API Secret</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showSecret ? 'text' : 'password'}
                name="apiSecret"
                value={config.apiSecret}
                onChange={handleConfigChange}
                className="input pl-10 pr-10"
                placeholder="Enter your API secret"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">ERPNext Version</label>
            <select
              name="version"
              value={config.version}
              onChange={handleConfigChange}
              className="input"
            >
              {ERPNEXT_VERSIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Version 14+ uses HRMS app for Employee Checkin
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              testResult.success ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testing || !config.url || !config.apiKey || !config.apiSecret}
              className="btn btn-secondary"
            >
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Sync Settings</h2>
            <p className="text-sm text-gray-500">Configure automatic synchronization</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Sync Frequency</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="60"
                value={syncFrequency}
                onChange={(e) => {
                  setSyncFrequency(parseInt(e.target.value))
                  setSaved(false)
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-20 text-center font-medium text-gray-900">
                {syncFrequency} min
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How often to sync attendance data with ERPNext
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Auto-start sync</p>
              <p className="text-sm text-gray-500">Start syncing when app launches</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => {
                  setAutoStart(e.target.checked)
                  setSaved(false)
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-success-600 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Settings saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  )
}
