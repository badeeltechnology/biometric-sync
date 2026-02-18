import React, { useState, useEffect } from 'react'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  ArrowDownUp
} from 'lucide-react'

const ITEMS_PER_PAGE = 20

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [syncHistory, setSyncHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('attendance')
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    deviceId: ''
  })
  const [devices, setDevices] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadData()
  }, [activeTab, page, filters])

  const loadData = async () => {
    try {
      setLoading(true)

      const deviceList = await window.electronAPI?.getDevices() || []
      setDevices(deviceList)

      if (activeTab === 'attendance') {
        const result = await window.electronAPI?.getAttendanceLogs({
          page,
          limit: ITEMS_PER_PAGE,
          ...filters
        }) || { logs: [], total: 0 }

        setLogs(result.logs || result)
        setTotalPages(Math.ceil((result.total || result.length) / ITEMS_PER_PAGE))
      } else {
        const history = await window.electronAPI?.getSyncHistory({
          page,
          limit: ITEMS_PER_PAGE
        }) || []
        setSyncHistory(history)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const getStatusBadge = (synced) => {
    if (synced) {
      return <span className="badge badge-success">Synced</span>
    }
    return <span className="badge badge-warning">Pending</span>
  }

  const getSyncStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success">Success</span>
      case 'partial':
        return <span className="badge badge-warning">Partial</span>
      case 'failed':
        return <span className="badge badge-danger">Failed</span>
      default:
        return <span className="badge badge-info">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Logs</h1>
          <p className="text-gray-500 mt-1">View attendance records and sync history</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('attendance'); setPage(1); }}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Attendance Logs
        </button>
        <button
          onClick={() => { setActiveTab('history'); setPage(1); }}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Sync History
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'attendance' && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by User ID..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input w-auto"
            >
              <option value="all">All Status</option>
              <option value="synced">Synced</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={filters.deviceId}
              onChange={(e) => handleFilterChange('deviceId', e.target.value)}
              className="input w-auto"
            >
              <option value="">All Devices</option>
              {devices.map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="input w-auto"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="input w-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : activeTab === 'attendance' ? (
        /* Attendance Logs Table */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Synced At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-gray-500">
                    <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    No attendance logs found
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{log.user_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        log.punch_type === 0 ? 'badge-success' : 'badge-info'
                      }`}>
                        {log.punch_type === 0 ? 'Check In' : 'Check Out'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {devices.find(d => d.id === log.device_id)?.name || log.device_id}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(log.synced)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {log.synced_at ? new Date(log.synced_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Sync History Table */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {syncHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-gray-500">
                    <ArrowDownUp className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    No sync history yet
                  </td>
                </tr>
              ) : (
                syncHistory.map((item, index) => {
                  const duration = item.completed_at && item.started_at
                    ? Math.round((new Date(item.completed_at) - new Date(item.started_at)) / 1000)
                    : null

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {devices.find(d => d.id === item.device_id)?.name || item.device_id}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(item.started_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {duration !== null ? `${duration}s` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            Fetched: <span className="font-medium">{item.records_fetched || 0}</span>
                          </span>
                          <span className="text-success-600">
                            Synced: <span className="font-medium">{item.records_synced || 0}</span>
                          </span>
                          {item.records_failed > 0 && (
                            <span className="text-danger-600">
                              Failed: <span className="font-medium">{item.records_failed}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getSyncStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {item.error_message || '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
