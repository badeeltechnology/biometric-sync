import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Filter,
  Users,
  Clock
} from 'lucide-react'

export default function Reports() {
  const [devices, setDevices] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null)

  const [filters, setFilters] = useState({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    deviceId: '',
    shiftId: '',
    format: 'excel',
    reportType: 'detailed'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [deviceList, shiftList] = await Promise.all([
        window.electronAPI?.getDevices() || [],
        window.electronAPI?.getShifts() || []
      ])
      setDevices(deviceList)
      setShifts(shiftList)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setExportResult(null)
  }

  const handleExport = async () => {
    setExporting(true)
    setExportResult(null)

    try {
      let result
      if (filters.format === 'excel') {
        result = await window.electronAPI?.exportToExcel(filters)
      } else {
        result = await window.electronAPI?.exportToPDF(filters)
      }

      setExportResult({
        success: true,
        message: `Report exported successfully!`,
        path: result.path
      })
    } catch (error) {
      setExportResult({
        success: false,
        message: error.message || 'Export failed'
      })
    } finally {
      setExporting(false)
    }
  }

  const ReportTypeCard = ({ type, title, description, icon: Icon }) => (
    <button
      onClick={() => handleFilterChange('reportType', type)}
      className={`p-4 rounded-xl border-2 transition-all text-left ${
        filters.reportType === type
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          filters.reportType === type ? 'bg-primary-100' : 'bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 ${
            filters.reportType === type ? 'text-primary-600' : 'text-gray-500'
          }`} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </button>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Export attendance data to Excel or PDF</p>
      </div>

      {/* Report Type Selection */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Report Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportTypeCard
            type="detailed"
            title="Detailed Report"
            description="Full list of all attendance records with timestamps"
            icon={FileText}
          />
          <ReportTypeCard
            type="summary"
            title="Summary Report"
            description="Aggregated data showing check-in/out counts per employee"
            icon={Users}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Filter Data</h3>
        <div className="space-y-4">
          {/* Date Range */}
          <div>
            <label className="label">Date Range</label>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="input pl-10"
                />
              </div>
              <span className="text-gray-500">to</span>
              <div className="flex-1 relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          {/* Device & Shift Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Device (optional)</label>
              <select
                value={filters.deviceId}
                onChange={(e) => handleFilterChange('deviceId', e.target.value)}
                className="input"
              >
                <option value="">All Devices</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shift (optional)</label>
              <select
                value={filters.shiftId}
                onChange={(e) => handleFilterChange('shiftId', e.target.value)}
                className="input"
              >
                <option value="">All Shifts</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Export Format */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Export Format</h3>
        <div className="flex gap-4">
          <button
            onClick={() => handleFilterChange('format', 'excel')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${
              filters.format === 'excel'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className={`w-6 h-6 ${
              filters.format === 'excel' ? 'text-primary-600' : 'text-gray-500'
            }`} />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Excel</p>
              <p className="text-sm text-gray-500">.xlsx format</p>
            </div>
          </button>

          <button
            onClick={() => handleFilterChange('format', 'pdf')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${
              filters.format === 'pdf'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileText className={`w-6 h-6 ${
              filters.format === 'pdf' ? 'text-primary-600' : 'text-gray-500'
            }`} />
            <div className="text-left">
              <p className="font-semibold text-gray-900">PDF</p>
              <p className="text-sm text-gray-500">.pdf format</p>
            </div>
          </button>
        </div>
      </div>

      {/* Export Result */}
      {exportResult && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          exportResult.success ? 'bg-success-50' : 'bg-danger-50'
        }`}>
          {exportResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          ) : (
            <Clock className="w-5 h-5 text-danger-600" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${
              exportResult.success ? 'text-success-600' : 'text-danger-600'
            }`}>
              {exportResult.message}
            </p>
            {exportResult.path && (
              <p className="text-sm text-gray-600 mt-1">
                Saved to: {exportResult.path}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting || !filters.dateFrom || !filters.dateTo}
          className="btn btn-primary btn-lg"
        >
          {exporting ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          Export Report
        </button>
      </div>
    </div>
  )
}
