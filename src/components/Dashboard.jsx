import React, { useState, useEffect } from 'react'
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react'

export default function Dashboard({ syncStatus }) {
  const [devices, setDevices] = useState([])
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    todaySynced: 0,
    pendingRecords: 0
  })
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load devices
      const deviceList = await window.electronAPI?.getDevices() || []
      setDevices(deviceList)

      // Load sync status
      const status = await window.electronAPI?.getSyncStatus() || {}

      setStats({
        totalDevices: deviceList.length,
        onlineDevices: deviceList.filter(d => d.status === 'online').length,
        todaySynced: status.today_synced || 0,
        pendingRecords: status.pending_records || 0
      })

      // Load recent logs
      const logs = await window.electronAPI?.getAttendanceLogs({ limit: 10 }) || []
      setRecentLogs(logs)

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSync = async () => {
    try {
      await window.electronAPI?.triggerSync()
      loadDashboardData()
    } catch (error) {
      console.error('Manual sync failed:', error)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Monitor your biometric sync status</p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={syncStatus.isRunning}
          className="btn btn-primary"
        >
          <RefreshCw className={`w-4 h-4 ${syncStatus.isRunning ? 'animate-spin' : ''}`} />
          {syncStatus.isRunning ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.totalDevices}
          icon={Activity}
          color="bg-primary-500"
        />
        <StatCard
          title="Online Devices"
          value={stats.onlineDevices}
          icon={Wifi}
          color="bg-success-500"
          subtitle={`${stats.totalDevices - stats.onlineDevices} offline`}
        />
        <StatCard
          title="Today's Synced"
          value={stats.todaySynced}
          icon={CheckCircle2}
          color="bg-success-500"
        />
        <StatCard
          title="Pending Records"
          value={stats.pendingRecords}
          icon={Clock}
          color={stats.pendingRecords > 0 ? "bg-warning-500" : "bg-gray-400"}
        />
      </div>

      {/* Device Status & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Status */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Device Status</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <WifiOff className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No devices configured</p>
                <p className="text-sm">Add devices in the Devices tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        device.status === 'online'
                          ? 'bg-success-500'
                          : 'bg-danger-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{device.name}</p>
                        <p className="text-sm text-gray-500">{device.ip}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${
                        device.status === 'online'
                          ? 'badge-success'
                          : 'badge-danger'
                      }`}>
                        {device.status || 'unknown'}
                      </span>
                      {device.last_sync && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last: {new Date(device.last_sync).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sync Logs */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      log.synced ? 'bg-success-50' : 'bg-warning-50'
                    }`}>
                      {log.synced ? (
                        <CheckCircle2 className="w-4 h-4 text-success-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-warning-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {log.user_id}
                      </p>
                      <p className="text-sm text-gray-500">
                        {log.punch_type === 0 ? 'Check In' : 'Check Out'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Progress Bar (when syncing) */}
      {syncStatus.isRunning && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-700">Syncing attendance data...</p>
                <p className="text-sm text-gray-500">{syncStatus.progress}%</p>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${syncStatus.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
