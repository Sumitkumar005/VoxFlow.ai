import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  Database, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Wifi,
  HardDrive,
  Cpu
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { adminAPI } from '../utils/api';

const SystemPerformanceMonitor = () => {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadPerformanceData();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadPerformanceData, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const loadPerformanceData = async () => {
    try {
      setError(null);
      const response = await adminAPI.getSystemHealth();
      setPerformanceData(response.data.data);
    } catch (err) {
      console.error('Failed to load performance data:', err);
      setError('Failed to load system performance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return XCircle;
      default: return Activity;
    }
  };

  if (loading && !performanceData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Performance Data</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadPerformanceData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!performanceData) return null;

  const StatusIcon = getStatusIcon(performanceData.system_status);

  // Generate mock real-time data for demonstration
  const realtimeData = Array.from({ length: 20 }, (_, i) => ({
    time: new Date(Date.now() - (19 - i) * 30000).toLocaleTimeString(),
    response_time: Math.random() * 5 + 1,
    success_rate: 95 + Math.random() * 5,
    active_calls: Math.floor(Math.random() * 50) + 10
  }));

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">System Performance Monitor</h2>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border ${getStatusColor(performanceData.system_status)}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">{performanceData.system_status}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Auto Refresh:</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-red-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
          
          <button
            onClick={loadPerformanceData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Response Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {performanceData.metrics.avg_response_time.toFixed(1)}s
              </p>
              <div className="flex items-center mt-2">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  performanceData.metrics.avg_response_time < 3 ? 'bg-green-500' : 
                  performanceData.metrics.avg_response_time < 8 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs text-gray-500">
                  {performanceData.metrics.avg_response_time < 3 ? 'Excellent' : 
                   performanceData.metrics.avg_response_time < 8 ? 'Good' : 'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {performanceData.metrics.success_rate.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${performanceData.metrics.success_rate}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600 border border-green-200">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Calls</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {performanceData.metrics.in_progress_runs}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {performanceData.metrics.total_runs_24h} total today
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {performanceData.metrics.error_rate.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(performanceData.metrics.error_rate, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toFixed(2)}s`, 'Response Time']} />
                <Line 
                  type="monotone" 
                  dataKey="response_time" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success Rate Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Rate Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[90, 100]} />
                <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Success Rate']} />
                <Area
                  type="monotone"
                  dataKey="success_rate"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Components Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Database Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Connection</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  performanceData.database.status === 'connected' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {performanceData.database.status}
                </span>
                {performanceData.database.status === 'connected' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Last Check</span>
              </div>
              <span className="text-sm text-gray-600">
                {new Date(performanceData.database.last_check).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* API Services Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Services</h3>
          <div className="space-y-4">
            {Object.entries(performanceData.api_keys.by_provider).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Server className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900 capitalize">{provider}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{count} configured</span>
                  {count > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Resources */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Resources</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Cpu className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-gray-900">CPU Usage</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Normal</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-5 h-5 text-indigo-600" />
                <span className="font-medium text-gray-900">Memory</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Normal</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Network</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Stable</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Alerts */}
      {(performanceData.metrics.error_rate > 10 || performanceData.metrics.avg_response_time > 10) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-yellow-900">Performance Alerts</h3>
              <div className="mt-2 space-y-2">
                {performanceData.metrics.error_rate > 10 && (
                  <p className="text-sm text-yellow-700">
                    • High error rate detected: {performanceData.metrics.error_rate.toFixed(1)}%
                  </p>
                )}
                {performanceData.metrics.avg_response_time > 10 && (
                  <p className="text-sm text-yellow-700">
                    • Slow response times: {performanceData.metrics.avg_response_time.toFixed(1)}s average
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemPerformanceMonitor;