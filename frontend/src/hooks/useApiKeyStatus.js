import { useState, useEffect, useCallback } from 'react';
import { apiKeyAPI } from '../utils/api';

export const useApiKeyStatus = () => {
  const [apiKeys, setApiKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const providerConfig = {
    groq: {
      name: 'Groq',
      required: true,
      fields: ['api_key'],
    },
    deepgram: {
      name: 'Deepgram',
      required: true,
      fields: ['api_key'],
    },
    twilio: {
      name: 'Twilio',
      required: false,
      fields: ['account_sid', 'auth_token', 'phone_number'],
    },
  };

  const loadApiKeys = useCallback(async () => {
    try {
      setError(null);
      const response = await apiKeyAPI.getAll();
      if (response.data.success) {
        setApiKeys(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setError(err.response?.data?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  // Check if a provider is configured
  const isProviderConfigured = useCallback((provider) => {
    const keyData = apiKeys[provider];
    if (!keyData) return false;

    const config = providerConfig[provider];
    if (!config) return false;

    // Check if all required fields are present
    return config.fields.every(field => keyData[field]?.trim());
  }, [apiKeys]);

  // Check if a provider is active (configured and validated)
  const isProviderActive = useCallback((provider) => {
    const keyData = apiKeys[provider];
    return keyData?.is_active === true;
  }, [apiKeys]);

  // Get provider status
  const getProviderStatus = useCallback((provider) => {
    if (isProviderActive(provider)) {
      return { status: 'active', message: 'Configured and validated' };
    }
    
    if (isProviderConfigured(provider)) {
      return { status: 'inactive', message: 'Configured but not validated' };
    }
    
    return { status: 'missing', message: 'Not configured' };
  }, [isProviderActive, isProviderConfigured]);

  // Check if all required providers are configured
  const areRequiredProvidersConfigured = useCallback(() => {
    const requiredProviders = Object.keys(providerConfig).filter(
      provider => providerConfig[provider].required
    );
    
    return requiredProviders.every(provider => isProviderActive(provider));
  }, [isProviderActive]);

  // Get overall system status
  const getOverallStatus = useCallback(() => {
    const requiredProviders = Object.keys(providerConfig).filter(
      provider => providerConfig[provider].required
    );
    
    const activeRequired = requiredProviders.filter(provider => isProviderActive(provider));
    const configuredRequired = requiredProviders.filter(provider => isProviderConfigured(provider));
    
    if (activeRequired.length === requiredProviders.length) {
      return { 
        status: 'ready', 
        message: 'All required API keys are configured',
        severity: 'success'
      };
    }
    
    if (configuredRequired.length === requiredProviders.length) {
      return { 
        status: 'needs_validation', 
        message: 'API keys need validation',
        severity: 'warning'
      };
    }
    
    if (configuredRequired.length > 0) {
      return { 
        status: 'partial', 
        message: 'Some required API keys are missing',
        severity: 'warning'
      };
    }
    
    return { 
      status: 'not_ready', 
      message: 'No API keys configured',
      severity: 'error'
    };
  }, [isProviderActive, isProviderConfigured]);

  // Get missing required providers
  const getMissingRequiredProviders = useCallback(() => {
    const requiredProviders = Object.keys(providerConfig).filter(
      provider => providerConfig[provider].required
    );
    
    return requiredProviders.filter(provider => !isProviderActive(provider));
  }, [isProviderActive]);

  // Check if user can perform actions that require API keys
  const canUseFeature = useCallback((requiredProviders = []) => {
    if (requiredProviders.length === 0) {
      return areRequiredProvidersConfigured();
    }
    
    return requiredProviders.every(provider => isProviderActive(provider));
  }, [areRequiredProvidersConfigured, isProviderActive]);

  return {
    // Data
    apiKeys,
    loading,
    error,
    
    // Actions
    refresh: loadApiKeys,
    
    // Status checks
    isProviderConfigured,
    isProviderActive,
    getProviderStatus,
    areRequiredProvidersConfigured,
    getOverallStatus,
    getMissingRequiredProviders,
    canUseFeature,
    
    // Configuration
    providerConfig,
  };
}