import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignAPI } from '../utils/api';
import { ArrowLeft, Play, Pause, Square, Eye } from 'lucide-react';
import { formatDateTime, getStatusColor } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaign();
  }, [id]);

  const loadCampaign = async () => {
    try {
      const response = await campaignAPI.getById(id);
      setCampaign(response.data.data);
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      await campaignAPI.start(id);
      alert('Campaign started successfully!');
      loadCampaign();
    } catch (error) {
      alert('Failed to start campaign');
    }
  };

  const handlePause = async () => {
    try {
      await campaignAPI.pause(id);
      alert('Campaign paused');
      loadCampaign();
    } catch (error) {
      alert('Failed to pause campaign');
    }
  };

  const handleResume = async () => {
    try {
      await campaignAPI.resume(id);
      alert('Campaign resumed');
      loadCampaign();
    } catch (error) {
      alert('Failed to resume campaign');
    }
  };

  const handleStop = async () => {
    if (window.confirm('Are you sure you want to stop this campaign?')) {
      try {
        await campaignAPI.stop(id);
        alert('Campaign stopped');
        loadCampaign();
      } catch (error) {
        alert('Failed to stop campaign');
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <button
        onClick={() => navigate('/campaigns')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Campaigns</span>
      </button>

      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{campaign.name}</h1>
            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(campaign.state)}`}>
              {campaign.state}
            </span>
          </div>

          <div className="flex space-x-2">
            {campaign.state === 'created' && (
              <button onClick={handleStart} className="btn-primary flex items-center space-x-2">
                <Play size={18} />
                <span>Start Campaign</span>
              </button>
            )}

            {campaign.state === 'running' && (
              <>
                <button onClick={handlePause} className="btn-secondary flex items-center space-x-2">
                  <Pause size={18} />
                  <span>Pause</span>
                </button>
                <button onClick={handleStop} className="btn-danger flex items-center space-x-2">
                  <Square size={18} />
                  <span>Stop</span>
                </button>
              </>
            )}

            {campaign.state === 'paused' && (
              <>
                <button onClick={handleResume} className="btn-primary flex items-center space-x-2">
                  <Play size={18} />
                  <span>Resume</span>
                </button>
                <button onClick={handleStop} className="btn-danger flex items-center space-x-2">
                  <Square size={18} />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-600">Agent</p>
            <p className="font-semibold text-gray-900">{campaign.agent?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Source Type</p>
            <p className="font-semibold text-gray-900">{campaign.source_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="font-semibold text-gray-900">{formatDateTime(campaign.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Agent Runs</h2>
        
        {campaign.runs && campaign.runs.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Run ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">State</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Created</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {campaign.runs.map((run) => (
                <tr key={run.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">#{run.run_number}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{formatDateTime(run.created_at)}</td>
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
        ) : (
          <p className="text-center py-8 text-gray-500">
            No runs yet. Start the campaign to begin execution.
          </p>
        )}
      </div>
    </div>
  );
};

export default CampaignDetails;