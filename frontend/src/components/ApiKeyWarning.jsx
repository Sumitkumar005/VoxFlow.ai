import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Key, X } from 'lucide-react';
import { useApiKeyStatus } from '../hooks/useApiKeyStatus';

const ApiKeyWarning = ({ 
  dismissible = false, 
  onDismiss = null,
  className = '',
  requiredProviders = null 
}) => {
  const { getOverallStatus, getMissingRequiredProviders, canUseFeature, loading } = useApiKeyStatus();
  
  // Don't show anything while loading to prevent flash
  if (loading) return null;
  
  // If specific providers are required, check those
  const shouldShow = requiredProviders 
    ? !canUseFeature(requiredProviders)
    : getOverallStatus().status !== 'ready';
  
  if (!shouldShow) return null;

  const overall = getOverallStatus();
  const missingProviders = getMissingRequiredProviders();
  
  const getBannerStyle = () => {
    switch (overall.severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getBannerStyle()} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium mb-1">API Keys Required</h3>
            <p className="text-sm mb-3">{overall.message}</p>
            
            {missingProviders.length > 0 && (
              <div className="text-sm mb-3">
                <span className="font-medium">Missing providers: </span>
                {missingProviders.join(', ')}
              </div>
            )}
            
            <Link
              to="/config/api-keys"
              className="inline-flex items-center space-x-2 text-sm font-medium hover:underline"
            >
              <Key className="w-4 h-4" />
              <span>Configure API Keys</span>
            </Link>
          </div>
        </div>
        
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-current hover:opacity-70 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyWarning;