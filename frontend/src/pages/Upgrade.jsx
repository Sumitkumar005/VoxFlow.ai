import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import SubscriptionPlans from '../components/SubscriptionPlans';
import UsageLimitNotification from '../components/UsageLimitNotification';
import { useAuth } from '../context/AuthContext';
import { usageAPI } from '../utils/api';

const Upgrade = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get reason for upgrade from URL params
  const reason = searchParams.get('reason'); // 'tokens', 'agents', 'features'
  const from = searchParams.get('from'); // referring page

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      console.log('Loading usage data for upgrade page...');
      const response = await usageAPI.getDashboard();
      console.log('Usage data loaded:', response.data);
      setUsage(response.data.data?.current_usage);
    } catch (error) {
      console.error('Failed to load usage:', error);
      // Don't block the page if usage fails to load
      setUsage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planKey) => {
    // In a real app, this would integrate with a payment processor
    console.log('Selected plan:', planKey);
    alert(`Upgrade to ${planKey} plan - Payment integration would go here`);
  };

  const getUpgradeReason = () => {
    switch (reason) {
      case 'tokens':
        return {
          title: 'You\'ve reached your token limit',
          description: 'Upgrade to get more tokens and continue using your voice AI agents.',
          highlight: 'pro'
        };
      case 'agents':
        return {
          title: 'You\'ve reached your agent limit',
          description: 'Upgrade to create more voice AI agents for your business.',
          highlight: 'pro'
        };
      case 'features':
        return {
          title: 'Unlock premium features',
          description: 'Get access to phone calls, analytics, and priority support.',
          highlight: 'pro'
        };
      default:
        return {
          title: 'Upgrade your plan',
          description: 'Get more capacity and features to grow your voice AI operations.',
          highlight: 'pro'
        };
    }
  };

  const upgradeReason = getUpgradeReason();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(from || '/agents')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            
            <div className="text-center flex-1 mx-8">
              <h1 className="text-2xl font-bold text-gray-900">{upgradeReason.title}</h1>
              <p className="text-gray-600 mt-1">{upgradeReason.description}</p>
            </div>
            
            <div className="w-16"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Usage Alert */}
        {usage && (
          <div className="mb-8">
            <UsageLimitNotification 
              usage={usage} 
              showUpgrade={false}
              className=""
            />
          </div>
        )}

        {/* Current Plan Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Current Plan: {user?.subscription_tier?.charAt(0).toUpperCase() + user?.subscription_tier?.slice(1)}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Agents:</span>
                  <span className="ml-2 font-medium">{usage?.agents || 0} / {user?.max_agents || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Tokens:</span>
                  <span className="ml-2 font-medium">
                    {((usage?.tokens_this_month || 0) / 1000).toFixed(1)}K / {((user?.monthly_token_quota || 0) / 1000).toFixed(1)}K
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Phone Calls:</span>
                  <span className="ml-2 font-medium">{user?.subscription_tier === 'free' ? 'Not included' : 'Included'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Support:</span>
                  <span className="ml-2 font-medium">{user?.subscription_tier === 'free' ? 'Community' : 'Priority'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Subscription Plans */}
        <SubscriptionPlans 
          showCurrentPlan={false}
          highlightUpgrade={true}
          onSelectPlan={handleSelectPlan}
        />

        {/* Benefits Section */}
        <div className="mt-16 bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Why Upgrade to Pro?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Scale Your Operations</h3>
              <p className="text-gray-600 text-sm">
                Create up to 10 AI agents and handle 50,000 tokens per month. 
                Perfect for growing businesses.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📞</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Phone Call Support</h3>
              <p className="text-gray-600 text-sm">
                Enable phone calls for your agents to reach customers directly. 
                Expand beyond web-only interactions.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
              <p className="text-gray-600 text-sm">
                Get detailed insights into your agent performance, usage patterns, 
                and cost optimization opportunities.
              </p>
            </div>
          </div>
        </div>

        {/* Money Back Guarantee */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">30-day money-back guarantee</span>
          </div>
          <p className="text-gray-600 text-sm mt-2">
            Try Pro risk-free. If you're not satisfied, we'll refund your money.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;