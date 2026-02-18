import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Fingerprint,
  Settings,
  FileText,
  Clock,
  Download,
  Menu,
  X
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import Devices from './components/Devices'
import SettingsPage from './components/Settings'
import Logs from './components/Logs'
import Reports from './components/Reports'
import Shifts from './components/Shifts'

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'devices', name: 'Devices', icon: Fingerprint },
  { id: 'shifts', name: 'Shifts', icon: Clock },
  { id: 'logs', name: 'Sync Logs', icon: FileText },
  { id: 'reports', name: 'Reports', icon: Download },
  { id: 'settings', name: 'Settings', icon: Settings },
]

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null,
    progress: 0
  })

  useEffect(() => {
    // Listen for sync events
    const unsubscribeStarted = window.electronAPI?.onSyncStarted(() => {
      setSyncStatus(prev => ({ ...prev, isRunning: true, progress: 0 }))
    })

    const unsubscribeCompleted = window.electronAPI?.onSyncCompleted((data) => {
      setSyncStatus(prev => ({
        ...prev,
        isRunning: false,
        lastSync: new Date().toISOString(),
        progress: 100
      }))
    })

    const unsubscribeError = window.electronAPI?.onSyncError((error) => {
      setSyncStatus(prev => ({ ...prev, isRunning: false }))
    })

    return () => {
      unsubscribeStarted?.()
      unsubscribeCompleted?.()
      unsubscribeError?.()
    }
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard syncStatus={syncStatus} />
      case 'devices':
        return <Devices />
      case 'shifts':
        return <Shifts />
      case 'logs':
        return <Logs />
      case 'reports':
        return <Reports />
      case 'settings':
        return <SettingsPage />
      default:
        return <Dashboard syncStatus={syncStatus} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-gray-900">BioSync</h1>
                <p className="text-xs text-gray-500">ERPNext Integration</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                {sidebarOpen && (
                  <span className="font-medium">{item.name}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Sync Status Indicator */}
        <div className="p-4 border-t border-gray-100">
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
            syncStatus.isRunning ? 'bg-primary-50' : 'bg-gray-50'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${
              syncStatus.isRunning
                ? 'bg-primary-500 animate-pulse-soft'
                : 'bg-success-500'
            }`} />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  {syncStatus.isRunning ? 'Syncing...' : 'Connected'}
                </p>
                {syncStatus.lastSync && !syncStatus.isRunning && (
                  <p className="text-xs text-gray-500 truncate">
                    Last: {new Date(syncStatus.lastSync).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-gray-100 text-gray-400 hover:text-gray-600 flex justify-center"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
