import { useEffect, useState } from 'react';
import { usageAPI } from '../utils/api';
import { BarChart3, Eye } from 'lucide-react';
import { formatDateTime, formatDuration, formatTokens, formatPhoneNumber } from '../utils/formatters';
import FilterBuilder from '../components/FilterBuilder';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Usage = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const [dashboardRes, historyRes] = await Promise.all([
        usageAPI.getDashboard(),
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usage Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor your Dograh Token usage and quota</p>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Tokens</h3>
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.total_tokens || '0.00'}</p>
          <p className="text-sm text-gray-500 mt-1">Current billing period</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Duration</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.total_duration_formatted || '0m 0s'}</p>
          <p className="text-sm text-gray-500 mt-1">All calls combined</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Runs</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard?.total_runs || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Completed calls</p>
        </div>
      </div>

      {/* Billing Period Info */}
      {dashboard && (
        <div className="card mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Current Billing Period</h3>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(dashboard.period_start).toLocaleDateString()} - {new Date(dashboard.period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Usage</p>
              <p className="text-2xl font-bold text-blue-600">
                {dashboard.total_tokens} / {dashboard.quota || '∞'}
              </p>
              <p className="text-xs text-gray-500">{dashboard.percentage_used}% Used</p>
            </div>
          </div>
        </div>
      )}

      {/* Usage History */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Usage History</h2>
          <FilterBuilder onApplyFilters={setFilters} />
        </div>

        {history.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No usage data found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Run ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Agent Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Phone Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Disposition</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Tokens</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">#{run.run_number}</td>
                    <td className="py-3 px-4">{run.agents?.name || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm">{formatPhoneNumber(run.phone_number)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{run.disposition || '-'}</td>
                    <td className="py-3 px-4 text-sm">{formatDateTime(run.created_at)}</td>
                    <td className="py-3 px-4 text-sm">{formatDuration(run.duration_seconds)}</td>
                    <td className="py-3 px-4 text-sm font-mono">{formatTokens(run.dograh_tokens)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => navigate(`/run/${run.id}/completed`)}
                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <Eye size={16} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Usage;