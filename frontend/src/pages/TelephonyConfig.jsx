import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { configAPI } from '../utils/api';
import { Loader2 } from 'lucide-react';
import SettingsLayout from '../components/SettingsLayout';

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
    <SettingsLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Telephony Configuration</h2>
        <p className="text-gray-600">Set up your Twilio credentials for phone calls</p>
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
              type="submit"
              disabled={saving}
              className="w-full btn-primary flex items-center justify-center"
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
    </SettingsLayout>
  );
};

export default TelephonyConfig;