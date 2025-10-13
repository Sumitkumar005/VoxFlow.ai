import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI } from '../utils/api';
import { ArrowLeft, Phone, Globe, History } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const AgentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgent();
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
  if (!agent) return <div>Agent not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Agents</span>
      </button>

      <div className="card mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{agent.name}</h1>
        <div className="flex items-center space-x-2 mb-4">
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            agent.type === 'OUTBOUND' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          }`}>
            {agent.type}
          </span>
          <span className="text-gray-600">{agent.use_case}</span>
        </div>
        <p className="text-gray-700">{agent.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate(`/agents/${id}/web-call`)}
          className="card hover:shadow-lg transition-shadow cursor-pointer"
        >
          <Globe className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Web Call</h3>
          <p className="text-sm text-gray-600">Test agent in browser</p>
        </button>

        <button
          onClick={() => navigate(`/agents/${id}/phone-call`)}
          className="card hover:shadow-lg transition-shadow cursor-pointer"
        >
          <Phone className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Phone Call</h3>
          <p className="text-sm text-gray-600">Make real phone call</p>
        </button>

        <button
          onClick={() => navigate(`/agents/${id}/runs`)}
          className="card hover:shadow-lg transition-shadow cursor-pointer"
        >
          <History className="h-8 w-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">View Run History</h3>
          <p className="text-sm text-gray-600">See all call records</p>
        </button>
      </div>
    </div>
  );
};

export default AgentDetails;