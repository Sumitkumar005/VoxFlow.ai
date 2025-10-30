import React from 'react';
import { 
  Activity, 
  Zap, 
  Database, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import LoadingSpinner from './LoadingSpinner';

// Performance Tab Component
const PerformanceTab = ({ data }) => {
  if (!data) return <LoadingSpinner />;

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

  const StatusIcon = getStatusIcon(data.system_status);

  const apiKeyData = [
    { name: 'Groq', configured: data.api_keys.by_provider.groq, color: '#3b82f6' },
    { name: 'Deepgram', configured: data.api_keys.by_provider.deepgram, color: '#10b981' },
    { name: 'Twilio', configured: data.api_keys.by_provider.twilio, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">System Health Overview</h3>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border ${getStatusColor(data.system_status)}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">{data.system_status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.metrics.success_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${data.metrics.success_rate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.metrics.error_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Error Rate</div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{ width: `${data.metrics.error_rate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.metrics.avg_response_time.toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.metrics.total_runs_24h}
            </div>
            <div className="text-sm text-gray-600">Runs (24h)</div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Key Configuration Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Configuration</h3>
          <div className="space-y-4">
            {apiKeyData.map((provider, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: provider.color }}
                  ></div>
                  <span className="font-medium text-gray-900">{provider.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {provider.configured} users configured
                  </span>
                  {provider.configured > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Total Configured Keys</span>
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {data.api_keys.total_configured}
            </div>
          </div>
        </div>

        {/* Database Health */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Connection Status</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  data.database.status === 'connected' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.database.status}
                </span>
                {data.database.status === 'connected' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">Last Check</span>
              </div>
              <span className="text-sm text-gray-600">
                {new Date(data.database.last_check).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">24-Hour Activity Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-900">
              {data.metrics.total_runs_24h - data.metrics.failed_runs_24h}
            </div>
            <div className="text-sm text-green-700">Successful Runs</div>
          </div>

          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-900">
              {data.metrics.failed_runs_24h}
            </div>
            <div className="text-sm text-red-700">Failed Runs</div>
          </div>

          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-900">
              {data.metrics.in_progress_runs}
            </div>
            <div className="text-sm text-yellow-700">In Progress</div>
          </div>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
        <div className="space-y-3">
          {data.metrics.error_rate > 10 && (
            <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">High Error Rate Detected</p>
                <p className="text-sm text-red-700">
                  Error rate is {data.metrics.error_rate.toFixed(1)}%. Consider investigating failed runs and API configurations.
                </p>
              </div>
            </div>
          )}

          {data.metrics.avg_response_time > 10 && (
            <div className="flex items-start space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Slow Response Times</p>
                <p className="text-sm text-yellow-700">
                  Average response time is {data.metrics.avg_response_time.toFixed(1)}s. Consider optimizing API calls or scaling resources.
                </p>
              </div>
            </div>
          )}

          {data.api_keys.total_configured < 10 && (
            <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Database className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Low API Key Configuration</p>
                <p className="text-sm text-blue-700">
                  Only {data.api_keys.total_configured} users have configured API keys. Consider providing setup guidance.
                </p>
              </div>
            </div>
          )}

          {data.metrics.error_rate <= 5 && data.metrics.avg_response_time <= 5 && (
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">System Performance Optimal</p>
                <p className="text-sm text-green-700">
                  All performance metrics are within acceptable ranges. System is operating efficiently.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceTab;