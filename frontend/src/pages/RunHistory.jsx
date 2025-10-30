import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI } from '../utils/api';
import { ArrowLeft, Eye } from 'lucide-react';
import { formatDateTime, formatDuration, formatTokens, getStatusColor } from '../utils/formatters';
import FilterBuilder from '../components/FilterBuilder';
import LoadingSpinner from '../components/LoadingSpinner';

const RunHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadRuns();
  }, [id, filters]);

  const loadRuns = async () => {
    try {
      const response = await agentAPI.getRuns(id, { ...filters, page: 1, limit: 20 });
      setRuns(response.data.data);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <button
        onClick={() => navigate(`/agents/${id}`)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Agent</span>
      </button>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflow Run History</h1>
          <p className="text-gray-600 mt-1">Showing {runs.length} runs</p>
        </div>
        <FilterBuilder onApplyFilters={handleApplyFilters} />
      </div>

      {runs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No runs found</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Created At</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Duration</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Disposition</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Tokens</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">#{run.run_number}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatDateTime(run.created_at)}</td>
                  <td className="py-3 px-4 text-sm">{formatDuration(run.duration_seconds)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{run.disposition || '-'}</td>
                  <td className="py-3 px-4 text-sm font-mono">{formatTokens(run.groq_tokens)}</td>
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
  );
};

export default RunHistory;