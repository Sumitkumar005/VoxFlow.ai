import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { Plus } from 'lucide-react';
import AgentCard from '../components/AgentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ApiKeyStatus from '../components/ApiKeyStatus';
import ApiKeyWarning from '../components/ApiKeyWarning';
import UsageLimitNotification from '../components/UsageLimitNotification';
import { useAuth } from '../context/AuthContext';
import { usageAPI } from '../utils/api';

const AgentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agents, loading, fetchAgents, deleteAgent } = useAgent();
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    fetchAgents();
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const response = await usageAPI.getDashboard();
      setUsage(response.data.data?.current_usage);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const handleView = (agent) => {
    navigate(`/agents/${agent.id}`);
  };

  const handleDelete = async (agent) => {
    if (window.confirm(`Delete agent "${agent.name}"?`)) {
      await deleteAgent(agent.id);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Workflows</h1>
          <p className="text-gray-600 mt-1">Manage your voice AI agents</p>
        </div>
        <button
          onClick={() => navigate('/agents/create')}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Usage Limit Notification */}
      {usage && (
        <UsageLimitNotification 
          usage={usage} 
          className="mb-6"
          showUpgrade={true}
        />
      )}

      {/* API Key Status and Warning */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ApiKeyWarning />
        </div>
        <div>
          <ApiKeyStatus compact={true} />
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No agents yet</p>
          <button onClick={() => navigate('/agents/create')} className="btn-primary">
            Create Your First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onView={handleView}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentList;