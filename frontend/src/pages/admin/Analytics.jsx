import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Download,
  Calendar,
  Activity,
  Zap,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { adminAPI } from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PerformanceTab from '../../components/PerformanceTab';
import SystemPerformanceMonitor from '../../components/SystemPerformanceMonitor';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    overview: null,
    userGrowth: null,
    usage: null,
    revenue: null,
    systemHealth: null
  });
  const [error, setError] = useState(null);

  const periods = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'growth', label: 'User Growth', icon: TrendingUp },
    { id: 'usage', label: 'Usage Analytics', icon: Activity },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'performance', label: 'Performance', icon: Zap }
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overview, userGrowth, usage, revenue, systemHealth] = await Promise.all([
        adminAPI.getPlatformOverview(),
        adminAPI.getUserGrowthAnalytics({ period: selectedPeriod }),
        adminAPI.getUsageAnalytics({ period: selectedPeriod === '7d' ? 'last_30_days' : 'current_month' }),
        adminAPI.getRevenueAnalytics(),
        adminAPI.getSystemHealth()
      ]);

      setData({
        overview: overview.data.data,
        userGrowth: userGrowth.data.data,
        usage: usage.data.data,
        revenue: revenue.data.data,
        systemHealth: systemHealth.data.data
      });
    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (type) => {
    try {
      const response = await adminAPI.exportAnalyticsData(type, { period: selectedPeriod });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `voxflow-${type}-analytics-${selectedPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to export data. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Analytics</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadAnalyticsData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600">Comprehensive insights into platform performance and growth</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            {periods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>

          {/* Export Button */}
          <div className="relative group">
            <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            {/* Export Dropdown */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <div className="py-2">
                <button
                  onClick={() => handleExportData('overview')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Platform Overview
                </button>
                <button
                  onClick={() => handleExportData('user-growth')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  User Growth Data
                </button>
                <button
                  onClick={() => handleExportData('usage')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Usage Analytics
                </button>
                <button
                  onClick={() => handleExportData('revenue')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Revenue Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && <OverviewTab data={data.overview} />}
        {activeTab === 'growth' && <UserGrowthTab data={data.userGrowth} />}
        {activeTab === 'usage' && <UsageAnalyticsTab data={data.usage} />}
        {activeTab === 'revenue' && <RevenueTab data={data.revenue} />}
        {activeTab === 'performance' && (
          <div className="space-y-8">
            <SystemPerformanceMonitor />
            <PerformanceTab data={data.systemHealth} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
//
 Overview Tab Component
const OverviewTab = ({ data }) => {
  if (!data) return <LoadingSpinner />;

  const metricCards = [
    {
      title: 'Total Users',
      value: data.users.total,
      change: data.growth.users,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Users',
      value: data.users.active,
      subtitle: `${Math.round((data.users.active / data.users.total) * 100)}% of total`,
      icon: Activity,
      color: 'green'
    },
    {
      title: 'Total Agents',
      value: data.agents.total,
      change: data.growth.agents,
      icon: BarChart3,
      color: 'purple'
    },
    {
      title: 'Total Runs',
      value: data.runs.total,
      change: data.growth.runs,
      icon: Zap,
      color: 'orange'
    }
  ];

  const subscriptionData = [
    { name: 'Free', value: data.users.by_tier.free, color: '#94a3b8' },
    { name: 'Pro', value: data.users.by_tier.pro, color: '#3b82f6' },
    { name: 'Enterprise', value: data.users.by_tier.enterprise, color: '#dc2626' }
  ];

  const runStatusData = [
    { name: 'Completed', value: data.runs.completed, color: '#10b981' },
    { name: 'Failed', value: data.runs.failed, color: '#ef4444' },
    { name: 'In Progress', value: data.runs.in_progress, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            green: 'bg-green-50 text-green-600 border-green-200',
            purple: 'bg-purple-50 text-purple-600 border-purple-200',
            orange: 'bg-orange-50 text-orange-600 border-orange-200'
          };

          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {metric.value.toLocaleString()}
                  </p>
                  {metric.subtitle && (
                    <p className="text-sm text-gray-500 mt-1">{metric.subtitle}</p>
                  )}
                  {metric.change !== undefined && (
                    <div className={`flex items-center mt-2 ${
                      metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <TrendingUp className={`w-4 h-4 mr-1 ${
                        metric.change < 0 ? 'rotate-180' : ''
                      }`} />
                      <span className="text-sm font-medium">
                        {Math.abs(metric.change).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg border ${colorClasses[metric.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution by Plan</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Run Status Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Run Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(data.runs.total_duration / 3600).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Hours of Calls</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(data.runs.total_tokens / 1000000).toFixed(1)}M
            </div>
            <div className="text-sm text-gray-600">Total Tokens Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.runs.completed > 0 ? Math.round((data.runs.completed / data.runs.total) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};/
/ User Growth Tab Component
const UserGrowthTab = ({ data }) => {
  if (!data) return <LoadingSpinner />;

  const growthData = data.growth_data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    new_users: item.new_users,
    cumulative: item.cumulative,
    free: item.free,
    pro: item.pro,
    enterprise: item.enterprise
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">New Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.summary.total_new_users}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Daily Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.summary.average_daily}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600 border border-green-200">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pro Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.summary.by_tier.pro}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Enterprise</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.summary.by_tier.enterprise}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-200">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="new_users" fill="#3b82f6" name="New Users" />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="cumulative" 
                stroke="#dc2626" 
                strokeWidth={2}
                name="Cumulative Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subscription Tier Growth */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth by Subscription Tier</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="free"
                stackId="1"
                stroke="#94a3b8"
                fill="#94a3b8"
                name="Free"
              />
              <Area
                type="monotone"
                dataKey="pro"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                name="Pro"
              />
              <Area
                type="monotone"
                dataKey="enterprise"
                stackId="1"
                stroke="#dc2626"
                fill="#dc2626"
                name="Enterprise"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};// Us
age Analytics Tab Component
const UsageAnalyticsTab = ({ data }) => {
  if (!data) return <LoadingSpinner />;

  const dailyTrends = data.daily_trends.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tokens: item.tokens,
    calls: item.calls,
    duration: Math.round(item.duration / 60), // Convert to minutes
    costs: item.costs
  }));

  const topUsers = data.top_users.slice(0, 10); // Show top 10 users

  return (
    <div className="space-y-6">
      {/* Platform Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(data.platform_totals.total_tokens / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Calls</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.platform_totals.total_calls.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600 border border-green-200">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Duration</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Math.round(data.platform_totals.total_duration / 3600)}h
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${data.platform_totals.total_costs.toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Usage Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${(value / 1000).toFixed(1)}K`, 'Tokens']} />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Call Volume Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calls" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cost Analysis</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']} />
              <Line
                type="monotone"
                dataKey="costs"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ fill: '#dc2626' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users by Usage</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Calls
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topUsers.map((user, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.email || 'Unknown User'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.subscription_tier || 'free'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(user.total_tokens / 1000).toFixed(1)}K
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.total_calls}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Math.round(user.total_duration / 60)}m
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${user.total_costs.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};// Reven
ue Tab Component
const RevenueTab = ({ data }) => {
  if (!data) return <LoadingSpinner />;

  const revenueData = [
    { name: 'Free', value: data.revenue_by_plan.free.revenue, count: data.revenue_by_plan.free.count, color: '#94a3b8' },
    { name: 'Pro', value: data.revenue_by_plan.pro.revenue, count: data.revenue_by_plan.pro.count, color: '#3b82f6' },
    { name: 'Enterprise', value: data.revenue_by_plan.enterprise.revenue, count: data.revenue_by_plan.enterprise.count, color: '#dc2626' }
  ];

  const monthlyTrends = data.monthly_trends.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    revenue: item.revenue,
    subscriptions: item.new_subscriptions,
    cumulative: item.cumulative_revenue
  }));

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${data.current_monthly_revenue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600 border border-green-200">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Projected Annual</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${data.projected_annual_revenue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.total_active_subscriptions}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {revenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Distribution</h3>
          <div className="space-y-4">
            {revenueData.map((plan, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: plan.color }}
                  ></div>
                  <div>
                    <p className="font-medium text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-600">{plan.count} subscribers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${plan.value}</p>
                  <p className="text-sm text-gray-600">monthly</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Trends */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends (Last 12 Months)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar 
                yAxisId="left" 
                dataKey="revenue" 
                fill="#3b82f6" 
                name="Monthly Revenue" 
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="subscriptions" 
                stroke="#dc2626" 
                strokeWidth={2}
                name="New Subscriptions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Projections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Projections</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              ${(data.current_monthly_revenue * 3).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Quarterly Projection</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              ${(data.current_monthly_revenue * 6).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">6-Month Projection</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              ${data.projected_annual_revenue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Annual Projection</div>
          </div>
        </div>
      </div>
    </div>
  );
};