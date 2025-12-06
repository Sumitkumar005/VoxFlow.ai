import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI } from '../utils/api';
import { ArrowLeft, Phone, Globe, History, Bot, Edit, Trash2, Play, BarChart3, Clock, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { extractUserFriendlyDescription, getAgentTypeClasses, generateAgentSummary } from '../utils/agentUtils';

const AgentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadAgent();
    setIsVisible(true);
  }, [id]);

  const loadAgent = async () => {
    try {
      const response = await agentAPI.getById(id);
      setAgent(response.data.data);
    } catch (error) {
      console.error('Failed to load agent:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!agent) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Agent not found</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Agents</span>
        </button>

        {/* Agent Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{agent.name}</h1>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    agent.type === 'INBOUND' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {agent.type}
                  </span>
                  <span className="text-gray-600">{agent.use_case}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate(`/agents/${id}/edit`)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button
                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-purple-600 font-medium">Total Calls</span>
                <Phone className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{agent.total_runs || 0}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-600 font-medium">Status</span>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {agent.total_runs > 0 ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-600 font-medium">Created</span>
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-bold text-green-900">
                {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agent Summary</h3>
              <p className="text-gray-700 leading-relaxed">
                {generateAgentSummary(agent)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agent Capabilities</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {extractUserFriendlyDescription(agent.description)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => navigate(`/agents/${id}/web-call`)}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-purple-500 p-6 transition-all group hover:shadow-lg"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
              Web Call
            </h3>
            <p className="text-gray-600">Test your agent directly in the browser with voice</p>
          </button>

          <button
            onClick={() => navigate(`/agents/${id}/phone-call`)}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-green-500 p-6 transition-all group hover:shadow-lg"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-green-700 transition-colors">
              Phone Call
            </h3>
            <p className="text-gray-600">Make a real phone call to any number</p>
          </button>

          <button
            onClick={() => navigate(`/agents/${id}/runs`)}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-blue-500 p-6 transition-all group hover:shadow-lg"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <History className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
              Run History
            </h3>
            <p className="text-gray-600">View all call records and transcripts</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentDetails;