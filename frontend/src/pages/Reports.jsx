import { useEffect, useState } from 'react';
import { reportAPI, agentAPI } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const Reports = () => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadReport();
    }
  }, [selectedDate, selectedAgent]);

  const loadAgents = async () => {
    try {
      const response = await agentAPI.getAll();
      setAgents(response.data.data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (selectedAgent) params.agent_id = selectedAgent;

      const response = await reportAPI.getDaily(params);
      setReportData(response.data.data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const params = { date: selectedDate };
      if (selectedAgent) params.agent_id = selectedAgent;

      const response = await reportAPI.downloadCSV(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `voxflow-report-${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('Failed to download report');
    }
  };

  // Prepare chart data
  const dispositionChartData = reportData?.disposition_distribution
    ? Object.entries(reportData.disposition_distribution).map(([key, value]) => ({
        name: key.replace(/_/g, ' '),
        count: value,
      }))
    : [];

  const durationChartData = reportData?.call_duration_distribution
    ? Object.entries(reportData.call_duration_distribution).map(([key, value]) => ({
        name: key,
        count: value,
      }))
    : [];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Reports</h1>
            <p className="text-gray-600 mt-1">Showing data for {selectedDate}</p>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 flex items-center space-x-2"
          >
            <Download size={18} />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Agent
            </label>
            <select
              className="input-field"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              className="input-field"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Agent Runs</h3>
            <p className="text-4xl font-bold text-purple-600">{reportData?.total_runs || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Calls processed today</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Transfer Dispositions</h3>
            <p className="text-4xl font-bold text-purple-600">{reportData?.transfer_dispositions || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Calls transferred (XFER)</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Disposition Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Disposition Distribution</h3>
            {dispositionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dispositionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-gray-500">No data available</p>
            )}
          </div>

          {/* Call Duration Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Call Duration Distribution</h3>
            {durationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={durationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-12 text-gray-500">No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;