import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI, callAPI, configAPI } from '../utils/api';
import { ArrowLeft, Phone, Loader2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const PhoneCall = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    loadAgent();
    checkTelephonyConfig();
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

  const checkTelephonyConfig = async () => {
    try {
      const response = await configAPI.getTelephony();
      setHasConfig(response.data.data?.is_configured || false);
    } catch (error) {
      console.error('Failed to check config:', error);
    }
  };

  const handleStartCall = async (e) => {
    e.preventDefault();
    
    if (!hasConfig) {
      if (window.confirm('Telephony not configured. Would you like to configure it now?')) {
        navigate('/config/telephony');
      }
      return;
    }

    setCalling(true);

    try {
      const response = await callAPI.startPhoneCall({
        agent_id: id,
        phone_number: phoneNumber,
      });

      alert(`Call initiated successfully with run name ${response.data.data.run_number}`);
      navigate(`/agents/${id}/runs`);
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to initiate call');
    } finally {
      setCalling(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(`/agents/${id}`)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Agent</span>
      </button>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Phone Call</h1>
        <p className="text-gray-600 mb-6">
          Enter the phone number to call. The number will be saved automatically.
        </p>

        {!hasConfig && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              ⚠️ Telephony not configured.{' '}
              <button
                onClick={() => navigate('/config/telephony')}
                className="text-yellow-900 font-semibold underline"
              >
                Configure Now
              </button>
            </p>
          </div>
        )}

        <form onSubmit={handleStartCall} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (with country code)
            </label>
            <input
              type="tel"
              className="input-field"
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <button
            type="submit"
            disabled={calling || !hasConfig}
            className="w-full btn-primary flex items-center justify-center space-x-2"
          >
            {calling ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Initiating Call...</span>
              </>
            ) : (
              <>
                <Phone size={20} />
                <span>Start Call</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PhoneCall;