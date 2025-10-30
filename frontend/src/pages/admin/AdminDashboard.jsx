import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  BarChart3, 
  DollarSign, 
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Database,
  Zap
} from 'lucide-react';
import { adminAPI } from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [dashboardRes, healthRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getSystemHealth(),
      ]);

      setDashboard(dashboardRes.data.data);
      setSystemHealth(healthRes.data.data);
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  const getHealthStatus = (status) => {
    switch (status) {
      case 'healthy':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', text: 'Healthy' };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', text: 'Warning' };
      case 'critical':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', text: 'Critical' };
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50', text: 'Unknown' };
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Platform overview and system health</p>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Activity className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* System Health Alert */}
      {systemHealth?.overall_status !== 'healthy' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900 mb-1">System Health Alert</h3>
              <p className="text-red-800 text-sm">
                One or more system components require attention. Check the system health section below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(dashboard?.total_users)}</p>
          <p className="text-sm text-gray-500 mt-1">
            +{dashboard?.new_users_today || 0} today
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Agents</h3>
            <BarChart3 className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(dashboard?.total_agents)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {dashboard?.agents_created_today || 0} created today
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Monthly Revenue</h3>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(dashboard?.monthly_revenue)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {dashboard?.revenue_growth >= 0 ? '+' : ''}{dashboard?.revenue_growth?.toFixed(1)}% vs last month
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">API Calls Today</h3>
            <Zap className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(dashboard?.api_calls_today)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {formatNumber(dashboard?.tokens_used_today)} tokens used
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">User Growth</h2>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          
          {dashboard?.user_growth ? (
            <div className="space-y-4">
              {dashboard.user_growth.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.date}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(item.users / Math.max(...dashboard.user_growth.map(g => g.users))) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{item.users}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No growth data available</p>
            </div>
          )}
        </div>

        {/* Subscription Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Subscription Plans</h2>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          
          {dashboard?.subscription_distribution ? (
            <div className="space-y-4">
              {Object.entries(dashboard.subscription_distribution).map(([plan, count]) => {
                const total = Object.values(dashboard.subscription_distribution).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
                
                const planColors = {
                  free: 'bg-gray-500',
                  pro: 'bg-blue-500',
                  enterprise: 'bg-purple-500'
                };
                
                return (
                  <div key={plan} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${planColors[plan] || 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium text-gray-900 capitalize">{plan}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">{percentage}%</span>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No subscription data available</p>
            </div>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
          <Server className="w-5 h-5 text-gray-600" />
        </div>
        
        {systemHealth ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(systemHealth.components || {}).map(([component, status]) => {
              const healthInfo = getHealthStatus(status.status);
              const Icon = healthInfo.icon;
              
              return (
                <div key={component} className={`${healthInfo.bg} border border-gray-200 rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 capitalize">{component.replace('_', ' ')}</h3>
                    <Icon className={`w-5 h-5 ${healthInfo.color}`} />
                  </div>
                  <p className={`text-sm ${healthInfo.color} font-medium mb-1`}>{healthInfo.text}</p>
                  {status.message && (
                    <p className="text-xs text-gray-600">{status.message}</p>
                  )}
                  {status.response_time && (
                    <p className="text-xs text-gray-500 mt-1">Response: {status.response_time}ms</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>System health data unavailable</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/admin/users')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Manage Users</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/analytics')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">View Analytics</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/logs')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Database className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-gray-900">System Logs</span>
          </button>
          
          <button 
            onClick={() => navigate('/admin/system')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-gray-900">Health Check</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;