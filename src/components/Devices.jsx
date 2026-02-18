import React, { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MapPin,
  X
} from 'lucide-react'

const PUNCH_DIRECTIONS = [
  { value: '', label: 'Auto Detect' },
  { value: 'IN', label: 'Check In Only' },
  { value: 'OUT', label: 'Check Out Only' }
]

const initialFormState = {
  name: '',
  ip: '',
  port: 4370,
  punch_direction: '',
  latitude: '',
  longitude: '',
  enabled: true
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [formData, setFormData] = useState(initialFormState)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      setLoading(true)
      const deviceList = await window.electronAPI?.getDevices() || []
      setDevices(deviceList)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingDevice(null)
    setFormData(initialFormState)
    setTestResult(null)
    setShowModal(true)
  }

  const openEditModal = (device) => {
    setEditingDevice(device)
    setFormData({
      name: device.name,
      ip: device.ip,
      port: device.port || 4370,
      punch_direction: device.punch_direction || '',
      latitude: device.latitude || '',
      longitude: device.longitude || '',
      enabled: device.enabled !== false
    })
    setTestResult(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingDevice(null)
    setFormData(initialFormState)
    setTestResult(null)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI?.testDevice({
        ip: formData.ip,
        port: parseInt(formData.port) || 4370
      })

      setTestResult({
        success: true,
        message: `Connected! Found ${result.user_count || 0} users on device.`
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const deviceData = {
        ...formData,
        port: parseInt(formData.port) || 4370,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      }

      if (editingDevice) {
        await window.electronAPI?.updateDevice({ ...deviceData, id: editingDevice.id })
      } else {
        await window.electronAPI?.addDevice(deviceData)
      }

      closeModal()
      loadDevices()
    } catch (error) {
      console.error('Failed to save device:', error)
      setTestResult({
        success: false,
        message: error.message || 'Failed to save device'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (device) => {
    if (!confirm(`Are you sure you want to delete "${device.name}"?`)) return

    try {
      await window.electronAPI?.deleteDevice(device.id)
      loadDevices()
    } catch (error) {
      console.error('Failed to delete device:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-500 mt-1">Manage your ZKTeco biometric devices</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* Device Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="card p-16 text-center">
          <WifiOff className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices configured</h3>
          <p className="text-gray-500 mb-6">Add your first biometric device to start syncing attendance data.</p>
          <button onClick={openAddModal} className="btn btn-primary mx-auto">
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div key={device.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    device.enabled ? 'bg-primary-50' : 'bg-gray-100'
                  }`}>
                    {device.status === 'online' ? (
                      <Wifi className={`w-5 h-5 ${device.enabled ? 'text-primary-600' : 'text-gray-400'}`} />
                    ) : (
                      <WifiOff className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{device.name}</h3>
                    <p className="text-sm text-gray-500">{device.ip}:{device.port || 4370}</p>
                  </div>
                </div>
                <span className={`badge ${
                  device.status === 'online'
                    ? 'badge-success'
                    : 'badge-danger'
                }`}>
                  {device.status || 'offline'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Direction</span>
                  <span className="text-gray-900">
                    {device.punch_direction || 'Auto'}
                  </span>
                </div>
                {(device.latitude && device.longitude) && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>{device.latitude}, {device.longitude}</span>
                  </div>
                )}
                {device.last_sync && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last Sync</span>
                    <span className="text-gray-900">
                      {new Date(device.last_sync).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(device)}
                  className="btn btn-ghost btn-sm flex-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(device)}
                  className="btn btn-ghost btn-sm text-danger-500 hover:bg-danger-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModal} />

            <div className="relative bg-white rounded-2xl max-w-lg w-full mx-auto shadow-xl transform transition-all">
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingDevice ? 'Edit Device' : 'Add Device'}
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Device Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="e.g., Main Entrance"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="label">IP Address</label>
                      <input
                        type="text"
                        name="ip"
                        value={formData.ip}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="192.168.1.100"
                        pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Port</label>
                      <input
                        type="number"
                        name="port"
                        value={formData.port}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="4370"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Punch Direction</label>
                    <select
                      name="punch_direction"
                      value={formData.punch_direction}
                      onChange={handleInputChange}
                      className="input"
                    >
                      {PUNCH_DIRECTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Latitude (optional)</label>
                      <input
                        type="number"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="25.2854"
                        step="any"
                      />
                    </div>
                    <div>
                      <label className="label">Longitude (optional)</label>
                      <input
                        type="number"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="51.5310"
                        step="any"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      name="enabled"
                      checked={formData.enabled}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="enabled" className="text-sm text-gray-700">
                      Enable this device for sync
                    </label>
                  </div>

                  {/* Test Connection Result */}
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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing || !formData.ip}
                      className="btn btn-secondary"
                    >
                      {testing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                      Test Connection
                    </button>
                    <div className="flex-1" />
                    <button type="button" onClick={closeModal} className="btn btn-ghost">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {editingDevice ? 'Save Changes' : 'Add Device'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
