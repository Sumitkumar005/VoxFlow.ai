import { useEffect, useState } from 'react';
import { usageAPI } from '../utils/api';
import { 
  BarChart3, 
  Eye, 
  TrendingUp, 
  Users, 
  Phone, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { formatDateTime, formatDuration, formatTokens, formatPhoneNumber } from '../utils/formatters';
import FilterBuilder from '../components/FilterBuilder';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Usage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('current'); // current, last30, last90

  useEffect(() => {
    loadData();
  }, [filters, selectedPeriod]);

  const loadData = async () => {
    try {
      const [dashboardRes, historyRes] = await Promise.all([
        usageAPI.getDashboard({ period: selectedPeriod }),
        usageAPI.getHistory({ ...filters, page: 1, limit: 20 }),
      ]);

      setDashboard(dashboardRes.data.data);
      setHistory(historyRes.data.data);
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for calculations
  const getUsagePercentage = (used, limit) => {
    if (!limit || limit === 0) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50 border-red-200';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  if (loading) return <LoadingSpinner />;

  // Calculate usage percentages
  const tokenUsagePercent = getUsagePercentage(
    dashboard?.current_usage?.tokens_this_month || 0,
    user?.monthly_token_quota || 0
  );
  
  const agentUsagePercent = getUsagePercentage(
    dashboard?.current_usage?.agents || 0,
    user?.max_agents || 0
  );

  return (
    <div>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Usage Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Monitor your usage and subscription limits for {user?.subscription_tier || 'Free'} plan
              </p>
            </div>
            
            {/* Period Selector */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="current">Current Month</option>
                <option value="last30">Last 30 Days</option>
                <option value="last90">Last 90 Days</option>
              </select>
            </div>
          </div>

      {/* Subscription Status Banner */}
      {(tokenUsagePercent >= 90 || agentUsagePercent >= 90) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-1">Usage Limit Warning</h3>
              <p className="text-red-800 text-sm mb-3">
                You're approaching your subscription limits. Consider upgrading your plan to avoid service interruption.
              </p>
              <button className="text-red-700 hover:text-red-900 text-sm font-medium underline">
                Upgrade Plan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Limit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Token Usage */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <h3 className="font-medium text-gray-900">Token Usage</h3>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(tokenUsagePercent)}`}>
              {tokenUsagePercent}% Used
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Used this month</span>
              <span>
                {formatTokens(dashboard?.current_usage?.tokens_this_month || 0)} / {formatTokens(user?.monthly_token_quota || 0)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(tokenUsagePercent)}`}
                style={{ width: `${tokenUsagePercent}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Resets on {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Agent Usage */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h3 className="font-medium text-gray-900">Agent Limit</h3>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(agentUsagePercent)}`}>
              {agentUsagePercent}% Used
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Active agents</span>
              <span>
                {dashboard?.current_usage?.agents || 0} / {user?.max_agents || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(agentUsagePercent)}`}
                style={{ width: `${agentUsagePercent}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Create up to {user?.max_agents || 0} voice AI agents</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Calls</h3>
            <Phone className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.total_runs || 0}</p>
          <p className="text-sm text-gray-500 mt-1">This period</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Call Duration</h3>
            <Clock className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.total_duration_formatted || '0m'}</p>
          <p className="text-sm text-gray-500 mt-1">Total time</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Estimated Cost</h3>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(dashboard?.estimated_cost)}</p>
          <p className="text-sm text-gray-500 mt-1">API usage cost</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Success Rate</h3>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.success_rate || '0'}%</p>
          <p className="text-sm text-gray-500 mt-1">Successful calls</p>
        </div>
      </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {dashboard?.cost_breakdown && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Cost Breakdown by Provider</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(dashboard.cost_breakdown).map(([provider, data]) => {
              const providerConfig = {
                groq: { name: 'Groq', icon: '🚀', color: 'bg-orange-500' },
                deepgram: { name: 'Deepgram', icon: '🎤', color: 'bg-blue-500' },
                twilio: { name: 'Twilio', icon: '📞', color: 'bg-red-500' },
              };
              
              const config = providerConfig[provider] || { name: provider, icon: '⚡', color: 'bg-gray-500' };
              
              return (
                <div key={provider} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{config.name}</h3>
                      <p className="text-sm text-gray-500">{data.calls || 0} calls</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Usage:</span>
                      <span className="font-medium">{formatTokens(data.tokens || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-medium text-green-600">{formatCurrency(data.cost)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900">Total Estimated Cost</span>
              <span className="text-2xl font-bold text-green-600">{formatCurrency(dashboard.estimated_cost)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Based on current API pricing. Actual costs may vary.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {user?.subscription_tier?.charAt(0).toUpperCase() + user?.subscription_tier?.slice(1)} Plan
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>• {user?.max_agents || 0} AI agents</p>
              <p>• {formatTokens(user?.monthly_token_quota || 0)} tokens per month</p>
              <p>• {user?.subscription_tier === 'free' ? 'Web calls only' : 'Phone calls included'}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">Active</span>
            </div>
            {user?.subscription_tier === 'free' && (
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Upgrade Plan →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
          <FilterBuilder onApplyFilters={setFilters} />
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No usage data found</p>
            <p className="text-sm text-gray-400">Start making calls to see your usage history</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Call</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Agent</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Tokens</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Cost</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-mono text-sm font-medium">#{run.run_number}</div>
                        {run.phone_number && (
                          <div className="text-xs text-gray-500">{formatPhoneNumber(run.phone_number)}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{run.agents?.name || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1">
                        {run.call_type === 'phone' ? (
                          <Phone className="w-4 h-4 text-blue-600" />
                        ) : (
                          <BarChart3 className="w-4 h-4 text-green-600" />
                        )}
                        <span className="text-sm capitalize">{run.call_type || 'web'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        run.disposition === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : run.disposition === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {run.disposition || 'unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {formatDateTime(run.created_at)}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium">
                      {formatDuration(run.duration_seconds)}
                    </td>
                    <td className="py-4 px-4 text-sm font-mono">
                      {formatTokens(run.groq_tokens)}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-green-600">
                      {formatCurrency(run.estimated_cost)}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => navigate(`/run/${run.id}/completed`)}
                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-sm"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {history.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Load More History →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Usage;