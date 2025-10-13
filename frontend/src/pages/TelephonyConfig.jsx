import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { configAPI } from '../utils/api';
import { ArrowLeft, Loader2, Phone } from 'lucide-react';

const TelephonyConfig = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'twilio',
    account_sid: '',
    auth_token: '',
    from_phone_number: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await configAPI.getTelephony();
      if (response.data.data) {
        setFormData({
          provider: response.data.data.provider || 'twilio',
          account_sid: response.data.data.account_sid || '',
          auth_token: '',
          from_phone_number: response.data.data.from_phone_number || '',
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await configAPI.saveTelephony(formData);
      alert('Telephony configuration saved successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <Phone className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configure Telephony</h1>
            <p className="text-gray-600">Set up your Twilio credentials for phone calls</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider
            </label>
            <select
              className="input-field"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
            >
              <option value="twilio">Twilio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account SID
            </label>
            <input
              type="text"
              className="input-field font-mono"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={formData.account_sid}
              onChange={(e) => setFormData({ ...formData, account_sid: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auth Token
            </label>
            <input
              type="password"
              className="input-field font-mono"
              placeholder="••••••••••••••••••••••••••••••••"
              value={formData.auth_token}
              onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Phone Number
            </label>
            <input
              type="tel"
              className="input-field"
              placeholder="+15551234567"
              value={formData.from_phone_number}
              onChange={(e) => setFormData({ ...formData, from_phone_number: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Your Twilio phone number with country code
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TelephonyConfig;