import React, { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  RefreshCw,
  CheckCircle2,
  X,
  Link
} from 'lucide-react'

const initialFormState = {
  name: '',
  start_time: '09:00',
  end_time: '18:00',
  erpnext_shift_type: '',
  device_ids: []
}

export default function Shifts() {
  const [shifts, setShifts] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [shiftList, deviceList] = await Promise.all([
        window.electronAPI?.getShifts() || [],
        window.electronAPI?.getDevices() || []
      ])
      setShifts(shiftList)
      setDevices(deviceList)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingShift(null)
    setFormData(initialFormState)
    setShowModal(true)
  }

  const openEditModal = (shift) => {
    setEditingShift(shift)
    setFormData({
      name: shift.name,
      start_time: shift.start_time || '09:00',
      end_time: shift.end_time || '18:00',
      erpnext_shift_type: shift.erpnext_shift_type || '',
      device_ids: shift.device_ids || []
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingShift(null)
    setFormData(initialFormState)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDeviceToggle = (deviceId) => {
    setFormData(prev => ({
      ...prev,
      device_ids: prev.device_ids.includes(deviceId)
        ? prev.device_ids.filter(id => id !== deviceId)
        : [...prev.device_ids, deviceId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingShift) {
        await window.electronAPI?.updateShift({ ...formData, id: editingShift.id })
      } else {
        await window.electronAPI?.addShift(formData)
      }

      closeModal()
      loadData()
    } catch (error) {
      console.error('Failed to save shift:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (shift) => {
    if (!confirm(`Are you sure you want to delete "${shift.name}"?`)) return

    try {
      await window.electronAPI?.deleteShift(shift.id)
      loadData()
    } catch (error) {
      console.error('Failed to delete shift:', error)
    }
  }

  const getDeviceNames = (deviceIds) => {
    return deviceIds
      .map(id => devices.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'No devices'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
          <p className="text-gray-500 mt-1">Configure shifts and map them to devices</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Shift
        </button>
      </div>

      {/* Shifts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="card p-16 text-center">
          <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No shifts configured</h3>
          <p className="text-gray-500 mb-6">Create shifts to map devices and sync with ERPNext.</p>
          <button onClick={openAddModal} className="btn btn-primary mx-auto">
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Shift Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Timing
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ERPNext Shift Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Devices
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900">{shift.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {shift.start_time} - {shift.end_time}
                  </td>
                  <td className="px-6 py-4">
                    {shift.erpnext_shift_type ? (
                      <span className="badge badge-info">{shift.erpnext_shift_type}</span>
                    ) : (
                      <span className="text-gray-400">Not linked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="text-sm">{getDeviceNames(shift.device_ids || [])}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(shift)}
                        className="btn btn-ghost btn-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(shift)}
                        className="btn btn-ghost btn-sm text-danger-500 hover:bg-danger-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    {editingShift ? 'Edit Shift' : 'Add Shift'}
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Shift Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="e.g., Morning Shift"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Start Time</label>
                      <input
                        type="time"
                        name="start_time"
                        value={formData.start_time}
                        onChange={handleInputChange}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">End Time</label>
                      <input
                        type="time"
                        name="end_time"
                        value={formData.end_time}
                        onChange={handleInputChange}
                        className="input"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">ERPNext Shift Type (optional)</label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="erpnext_shift_type"
                        value={formData.erpnext_shift_type}
                        onChange={handleInputChange}
                        className="input pl-10"
                        placeholder="Enter Shift Type name from ERPNext"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Must match the Shift Type name in ERPNext exactly
                    </p>
                  </div>

                  <div>
                    <label className="label">Linked Devices</label>
                    {devices.length === 0 ? (
                      <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                        No devices available. Add devices first.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                        {devices.map((device) => (
                          <label
                            key={device.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              formData.device_ids.includes(device.id)
                                ? 'bg-primary-50 border-primary-200'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.device_ids.includes(device.id)}
                              onChange={() => handleDeviceToggle(device.id)}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{device.name}</p>
                              <p className="text-sm text-gray-500">{device.ip}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="btn btn-ghost">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {editingShift ? 'Save Changes' : 'Add Shift'}
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
