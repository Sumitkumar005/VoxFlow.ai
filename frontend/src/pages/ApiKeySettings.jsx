import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Shield,
  ExternalLink,
  Info
} from 'lucide-react';
import { apiKeyAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import SettingsLayout from '../components/SettingsLayout';

const ApiKeySettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [validating, setValidating] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState({});
  const [apiKeys, setApiKeys] = useState({
    groq: { api_key: '', is_active: false },
    deepgram: { api_key: '', is_active: false },
    twilio: { 
      account_sid: '', 
      auth_token: '', 
      phone_number: '', 
      is_active: false 
    },
  });

  // Provider configurations
  const providers = {
    groq: {
      name: 'Groq',
      description: 'Fast AI inference for language models',
      fields: [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'gsk_...',
          required: true,
        }
      ],
      docsUrl: 'https://console.groq.com/keys',
      icon: '🚀',
      color: 'bg-orange-500',
    },
    deepgram: {
      name: 'Deepgram',
      description: 'Speech-to-text and text-to-speech services',
      fields: [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'Token ...',
          required: true,
        }
      ],
      docsUrl: 'https://console.deepgram.com/',
      icon: '🎤',
      color: 'bg-blue-500',
    },
    twilio: {
      name: 'Twilio',
      description: 'Phone calls and SMS services',
      fields: [
        {
          key: 'account_sid',
          label: 'Account SID',
          type: 'text',
          placeholder: 'AC...',
          required: true,
        },
        {
          key: 'auth_token',
          label: 'Auth Token',
          type: 'password',
          placeholder: 'Your auth token',
          required: true,
        },
        {
          key: 'phone_number',
          label: 'Phone Number',
          type: 'tel',
          placeholder: '+1234567890',
          required: true,
        }
      ],
      docsUrl: 'https://console.twilio.com/',
      icon: '📞',
      color: 'bg-red-500',
    },
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await apiKeyAPI.getAll();
      if (response.data.success) {
        const keys = response.data.data;
        setApiKeys(prevKeys => ({
          ...prevKeys,
          ...keys,
        }));
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
      setErrors({ general: 'Failed to load API keys. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (provider, field, value) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      }
    }));

    // Clear errors when user starts typing
    if (errors[provider]) {
      setErrors(prev => ({
        ...prev,
        [provider]: null,
      }));
    }
  };

  const toggleShowKey = (provider, field) => {
    const key = `${provider}_${field}`;
    setShowKeys(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const validateApiKey = async (provider) => {
    setValidating(prev => ({ ...prev, [provider]: true }));
    setErrors(prev => ({ ...prev, [provider]: null }));

    try {
      const keyData = apiKeys[provider];
      const response = await apiKeyAPI.validate(provider, keyData);
      
      if (response.data.success) {
        setSuccess(prev => ({ ...prev, [provider]: 'API key is valid!' }));
        setTimeout(() => {
          setSuccess(prev => ({ ...prev, [provider]: null }));
        }, 3000);
      }
    } catch (error) {
      console.error(`Failed to validate ${provider} API key:`, error);
      setErrors(prev => ({
        ...prev,
        [provider]: error.response?.data?.message || `Failed to validate ${provider} API key`,
      }));
    } finally {
      setValidating(prev => ({ ...prev, [provider]: false }));
    }
  };

  const saveApiKey = async (provider) => {
    setSaving(prev => ({ ...prev, [provider]: true }));
    setErrors(prev => ({ ...prev, [provider]: null }));

    try {
      const keyData = apiKeys[provider];
      const response = await apiKeyAPI.save(provider, keyData);
      
      if (response.data.success) {
        setSuccess(prev => ({ ...prev, [provider]: 'API key saved successfully!' }));
        setApiKeys(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            is_active: true,
          }
        }));
        
        setTimeout(() => {
          setSuccess(prev => ({ ...prev, [provider]: null }));
        }, 3000);
      }
    } catch (error) {
      console.error(`Failed to save ${provider} API key:`, error);
      setErrors(prev => ({
        ...prev,
        [provider]: error.response?.data?.message || `Failed to save ${provider} API key`,
      }));
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const deleteApiKey = async (provider) => {
    if (!confirm(`Are you sure you want to delete your ${providers[provider].name} API key?`)) {
      return;
    }

    setSaving(prev => ({ ...prev, [provider]: true }));

    try {
      await apiKeyAPI.delete(provider);
      setApiKeys(prev => ({
        ...prev,
        [provider]: Object.keys(providers[provider].fields).reduce((acc, field) => {
          acc[field.key] = '';
          return acc;
        }, { is_active: false }),
      }));
      
      setSuccess(prev => ({ ...prev, [provider]: 'API key deleted successfully!' }));
      setTimeout(() => {
        setSuccess(prev => ({ ...prev, [provider]: null }));
      }, 3000);
    } catch (error) {
      console.error(`Failed to delete ${provider} API key:`, error);
      setErrors(prev => ({
        ...prev,
        [provider]: error.response?.data?.message || `Failed to delete ${provider} API key`,
      }));
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const isProviderConfigured = (provider) => {
    const providerData = apiKeys[provider];
    return providers[provider].fields.every(field => 
      field.required ? providerData[field.key]?.trim() : true
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <SettingsLayout>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Key Management</h2>
        <p className="text-gray-600">
          Configure your API keys for AI services. Your keys are encrypted and stored securely.
        </p>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Security & Privacy</h3>
            <p className="text-blue-800 text-sm">
              Your API keys are encrypted using AES-256-GCM encryption before being stored. 
              We never log or expose your keys in plain text. Each key is tied to your account 
              and cannot be accessed by other users.
            </p>
          </div>
        </div>
      </div>

      {/* General Error */}
      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
          <p className="text-red-700 text-sm">{errors.general}</p>
        </div>
      )}

      {/* API Key Providers */}
      <div className="space-y-8">
        {Object.entries(providers).map(([provider, config]) => {
          const providerData = apiKeys[provider];
          const isConfigured = isProviderConfigured(provider);
          const hasError = errors[provider];
          const hasSuccess = success[provider];
          const isSaving = saving[provider];
          const isValidating = validating[provider];

          return (
            <div key={provider} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Provider Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 ${config.color} rounded-lg flex items-center justify-center text-white text-xl`}>
                      {config.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{config.name}</h2>
                      <p className="text-gray-600 text-sm">{config.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Status Indicator */}
                    <div className="flex items-center space-x-2">
                      {providerData.is_active ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-green-700 text-sm font-medium">Configured</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-500 text-sm font-medium">Not Configured</span>
                        </>
                      )}
                    </div>
                    
                    {/* Documentation Link */}
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                    >
                      <span>Get API Key</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Provider Form */}
              <div className="p-6">
                {/* Success Message */}
                {hasSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <p className="text-green-700 text-sm">{hasSuccess}</p>
                  </div>
                )}

                {/* Error Message */}
                {hasError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{hasError}</p>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  {config.fields.map((field) => {
                    const fieldValue = providerData[field.key] || '';
                    const showKey = showKeys[`${provider}_${field.key}`];
                    
                    return (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={field.type === 'password' && !showKey ? 'password' : 'text'}
                            value={fieldValue}
                            onChange={(e) => handleInputChange(provider, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            disabled={isSaving}
                          />
                          {field.type === 'password' && (
                            <button
                              type="button"
                              onClick={() => toggleShowKey(provider, field.key)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    {/* Save Button */}
                    <button
                      onClick={() => saveApiKey(provider)}
                      disabled={!isConfigured || isSaving}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>

                    {/* Validate Button */}
                    {isConfigured && (
                      <button
                        onClick={() => validateApiKey(provider)}
                        disabled={isValidating || isSaving}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Validating...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Test Connection</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Delete Button */}
                  {providerData.is_active && (
                    <button
                      onClick={() => deleteApiKey(provider)}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Information */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-gray-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-gray-900 mb-2">How API Keys Are Used</h3>
            <ul className="text-gray-600 text-sm space-y-1">
              <li>• <strong>Groq:</strong> Powers the AI language models for your voice agents</li>
              <li>• <strong>Deepgram:</strong> Handles speech-to-text and text-to-speech conversion</li>
              <li>• <strong>Twilio:</strong> Enables phone call functionality for your agents</li>
            </ul>
            <p className="text-gray-600 text-sm mt-3">
              Your usage and costs are tracked separately for each provider. 
              You can view detailed usage statistics in your dashboard.
            </p>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default ApiKeySettings;