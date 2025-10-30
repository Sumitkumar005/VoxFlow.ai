import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  TrendingUp, 
  Zap, 
  Users,
  ExternalLink 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UsageLimitNotification = ({ 
  usage, 
  onDismiss = null, 
  showUpgrade = true,
  className = '' 
}) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Calculate usage percentages
  const tokenUsagePercent = user?.monthly_token_quota > 0 
    ? Math.round((usage?.tokens_this_month || 0) / user.monthly_token_quota * 100)
    : 0;
    
  const agentUsagePercent = user?.max_agents > 0 
    ? Math.round((usage?.agents || 0) / user.max_agents * 100)
    : 0;

  // Determine notification level
  const getNotificationLevel = () => {
    const maxPercent = Math.max(tokenUsagePercent, agentUsagePercent);
    if (maxPercent >= 95) return 'critical';
    if (maxPercent >= 85) return 'warning';
    if (maxPercent >= 75) return 'info';
    return null;
  };

  const level = getNotificationLevel();
  if (!level) return null;

  const notificationConfig = {
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500',
      title: 'Usage Limit Reached',
      message: 'You have reached your subscription limits. Upgrade now to continue using VoxFlow.',
      urgency: 'high'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-500',
      title: 'Approaching Usage Limits',
      message: 'You are close to your subscription limits. Consider upgrading to avoid interruption.',
      urgency: 'medium'
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-500',
      title: 'Usage Update',
      message: 'You have used a significant portion of your monthly quota.',
      urgency: 'low'
    }
  };

  const config = notificationConfig[level];

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const formatTokens = (tokens) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens?.toString() || '0';
  };

  const subscriptionPlans = {
    free: {
      name: 'Free',
      nextPlan: 'pro',
      nextPlanName: 'Pro',
      nextPlanPrice: '$29/month',
      benefits: ['10 AI Agents', '50K tokens/month', 'Phone calls', 'Priority support']
    },
    pro: {
      name: 'Pro',
      nextPlan: 'enterprise',
      nextPlanName: 'Enterprise',
      nextPlanPrice: '$299/month',
      benefits: ['100 AI Agents', '1M tokens/month', 'Custom integrations', 'Dedicated support']
    }
  };

  const currentPlan = subscriptionPlans[user?.subscription_tier] || subscriptionPlans.free;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertTriangle className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
          
          <div className="flex-1">
            <h3 className={`font-medium ${config.textColor} mb-2`}>{config.title}</h3>
            <p className={`text-sm ${config.textColor} mb-4`}>{config.message}</p>
            
            {/* Usage Details */}
            <div className="space-y-2 mb-4">
              {tokenUsagePercent >= 75 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4" />
                    <span>Token Usage:</span>
                  </div>
                  <span className="font-medium">
                    {formatTokens(usage?.tokens_this_month)} / {formatTokens(user?.monthly_token_quota)} ({tokenUsagePercent}%)
                  </span>
                </div>
              )}
              
              {agentUsagePercent >= 75 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Agent Usage:</span>
                  </div>
                  <span className="font-medium">
                    {usage?.agents} / {user?.max_agents} agents ({agentUsagePercent}%)
                  </span>
                </div>
              )}
            </div>
            
            {/* Upgrade Section */}
            {showUpgrade && currentPlan.nextPlan && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">Upgrade to {currentPlan.nextPlanName}</h4>
                    <p className="text-sm text-gray-600">{currentPlan.nextPlanPrice}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  {currentPlan.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                  <span>Upgrade Now</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button className={`text-sm font-medium ${config.textColor} hover:underline`}>
                View Usage Details →
              </button>
              {level === 'info' && (
                <button className={`text-sm ${config.textColor} hover:underline`}>
                  Learn about limits →
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className={`${config.textColor} hover:opacity-70 transition-opacity ml-4`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default UsageLimitNotification;