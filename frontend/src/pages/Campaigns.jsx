import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignAPI } from '../utils/api';
import { Plus, Eye, Radio, Users, Clock, Play, Pause, CheckCircle, XCircle, Loader } from 'lucide-react';
import { formatDate, getStatusColor } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await campaignAPI.getAll();
      setCampaigns(response.data.data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStateIcon = (state) => {
    switch(state) {
      case 'running': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'stopped': return <XCircle className="w-4 h-4" />;
      default: return <Loader className="w-4 h-4" />;
    }
  };

  const getStateColor = (state) => {
    switch(state) {
      case 'running': return 'bg-green-100 text-green-700 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'stopped': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-gray-600 mt-1">Manage your bulk calling campaigns</p>
          </div>
          <button
            onClick={() => navigate('/campaigns/create')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Create Campaign</span>
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-6">Create your first campaign to start bulk calling</p>
            <button
              onClick={() => navigate('/campaigns/create')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{campaign.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          Agent: {campaign.agent?.name}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(campaign.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1 ${getStateColor(campaign.state)}`}>
                          {getStateIcon(campaign.state)}
                          <span className="capitalize">{campaign.state}</span>
                        </span>
                        {campaign.agent?.type && (
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            campaign.agent.type === 'INBOUND' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {campaign.agent.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/campaigns/${campaign.id}`);
                    }}
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex items-center space-x-2 font-medium"
                  >
                    <Eye size={16} />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;