import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignAPI } from '../utils/api';
import { Plus, Eye } from 'lucide-react';
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600 mt-1">Manage your bulk workflow execution campaigns</p>
        </div>
        <button
          onClick={() => navigate('/campaigns/create')}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Create Campaign</span>
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No campaigns found</p>
          <button
            onClick={() => navigate('/campaigns/create')}
            className="btn-primary"
          >
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Workflow</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">State</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Created</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{campaign.name}</td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium">{campaign.agent?.name}</div>
                      <div className="text-sm text-gray-500">{campaign.agent?.type}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.state)}`}>
                      {campaign.state}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(campaign.created_at)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
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

export default Campaigns;