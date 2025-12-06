import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { Plus, Search, RefreshCw, Bot, Phone, Clock, Settings, Trash2, Play } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ApiKeyWarning from '../components/ApiKeyWarning';
import UsageLimitNotification from '../components/UsageLimitNotification';
import { useAuth } from '../context/AuthContext';
import { usageAPI } from '../utils/api';

// Memoized Agent Card Component
const AgentCard = memo(({ agent, isSelected, onClick, index, isVisible }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${
      isSelected
        ? 'bg-purple-50 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
        : 'bg-white border-2 border-gray-200 hover:border-purple-300'
    } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
    style={{ transitionDelay: `${index * 50}ms` }}
  >
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          agent.total_runs > 0 ? 'bg-green-500' : 'bg-gray-300'
        }`} />
        <h3 className="font-semibold text-gray-900 text-sm">{agent.name}</h3>
      </div>
      <span className={`px-2 py-0.5 text-xs rounded-full ${
        agent.type === 'INBOUND'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-purple-100 text-purple-700'
      }`}>
        {agent.type}
      </span>
    </div>
    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{agent.use_case}</p>
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span className="flex items-center">
        <Phone className="w-3 h-3 mr-1" />
        {agent.total_runs} calls
      </span>
      <span className="flex items-center">
        <Clock className="w-3 h-3 mr-1" />
        {new Date(agent.created_at).toLocaleDateString()}
      </span>
    </div>
  </button>
));

AgentCard.displayName = 'AgentCard';

const AgentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agents, loading, fetchAgents, deleteAgent } = useAgent();
  const [usage, setUsage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    fetchAgents();
    loadUsage();
  }, []);

  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0]);
    }
  }, [agents]);

  const loadUsage = async () => {
    try {
      const response = await usageAPI.getDashboard();
      setUsage(response.data.data?.current_usage);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const handleDelete = useCallback(async (agent) => {
    if (window.confirm(`Delete agent "${agent.name}"?`)) {
      await deleteAgent(agent.id);
      if (selectedAgent?.id === agent.id) {
        setSelectedAgent(agents[0]);
      }
    }
  }, [deleteAgent, selectedAgent, agents]);

  const filteredAgents = useMemo(() => 
    agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [agents, searchQuery]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Left Panel - Agent List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Agents</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchAgents}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 group"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-600 group-hover:rotate-180 transition-transform duration-500" />
              </button>
              <button
                onClick={() => navigate('/agents/create')}
                className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/50 active:scale-95"
                title="Create Agent"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 hover:border-gray-300 hover:shadow-md"
            />
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAgents.length === 0 ? (
            <div className="p-6 text-center">
              <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-4">
                {searchQuery ? 'No agents found' : 'No agents yet'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate('/agents/create')}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  Create your first agent
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredAgents.map((agent, index) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  index={index}
                  isVisible={isVisible}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Agent Details */}
      <div className="flex-1 overflow-y-auto">
        {/* Notifications */}
        <div className="p-6 space-y-4">
          <ApiKeyWarning />
          {usage && <UsageLimitNotification usage={usage} showUpgrade={true} />}
        </div>

        {selectedAgent ? (
          <div className="p-6">
            {/* Agent Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedAgent.name}</h1>
                    <p className="text-gray-600 text-sm mb-2">{selectedAgent.use_case}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center text-gray-500">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          selectedAgent.total_runs > 0 ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        {selectedAgent.total_runs > 0 ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        Created {new Date(selectedAgent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/agents/${selectedAgent.id}/edit`)}
                    className="group px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-500 hover:text-purple-600 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center space-x-2"
                  >
                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => handleDelete(selectedAgent)}
                    className="group px-4 py-2 bg-white border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-500 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate(`/agents/${selectedAgent.id}/web-call`)}
                  className="group flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 flex items-center justify-center space-x-2 font-medium"
                >
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Test Agent</span>
                </button>
                <button
                  onClick={() => navigate(`/agents/${selectedAgent.id}/phone-call`)}
                  className="group flex-1 px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg flex items-center justify-center space-x-2 font-medium"
                >
                  <Phone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span>Make Call</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:shadow-xl hover:scale-105 hover:border-purple-300 transition-all duration-300 cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm group-hover:text-purple-600 transition-colors">Total Calls</span>
                  <Phone className="w-5 h-5 text-purple-600 group-hover:rotate-12 transition-transform" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{selectedAgent.total_runs}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:shadow-xl hover:scale-105 hover:border-purple-300 transition-all duration-300 cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm group-hover:text-purple-600 transition-colors">Agent Type</span>
                  <Bot className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{selectedAgent.type}</p>
                <p className="text-xs text-gray-500 mt-1">Call direction</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:shadow-xl hover:scale-105 hover:border-purple-300 transition-all duration-300 cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm group-hover:text-purple-600 transition-colors">Status</span>
                  <div className={`w-3 h-3 rounded-full ${
                    selectedAgent.total_runs > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                  }`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedAgent.total_runs > 0 ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Current state</p>
              </div>
            </div>

            {/* Agent Description */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agent Prompt</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedAgent.description}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Select an agent to view details</p>
              <button
                onClick={() => navigate('/agents/create')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create New Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentList;