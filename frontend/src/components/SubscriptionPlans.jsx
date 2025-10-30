import React from 'react';
import { Check, Star, Zap, Users, Phone, BarChart3, Shield, Headphones } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SubscriptionPlans = ({
  showCurrentPlan = true,
  highlightUpgrade = false,
  onSelectPlan = null
}) => {
  const { user } = useAuth();

  const plans = {
    free: {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out VoxFlow',
      features: [
        { icon: Users, text: '3 AI Agents', included: true },
        { icon: Zap, text: '10,000 tokens/month', included: true },
        { icon: BarChart3, text: 'Web calls only', included: true },
        { icon: Shield, text: 'Basic security', included: true },
        { icon: Phone, text: 'Phone calls', included: false },
        { icon: Headphones, text: 'Email support', included: false }
      ]
    },
    pro: {
      name: 'Pro',
      price: '$49',
      period: 'month',
      description: 'Best for growing businesses',
      popular: true,
      features: [
        { icon: Users, text: '10 AI Agents', included: true },
        { icon: Zap, text: '100,000 tokens/month', included: true },
        { icon: Phone, text: 'Phone calls included', included: true },
        { icon: BarChart3, text: 'Advanced analytics', included: true },
        { icon: Shield, text: 'Enhanced security', included: true },
        { icon: Headphones, text: 'Priority email support', included: true }
      ]
    },
    enterprise: {
      name: 'Enterprise',
      price: '$199',
      period: 'month',
      description: 'For large-scale operations',
      features: [
        { icon: Users, text: 'Unlimited AI Agents', included: true },
        { icon: Zap, text: '1,000,000 tokens/month', included: true },
        { icon: Phone, text: 'Unlimited phone calls', included: true },
        { icon: BarChart3, text: 'Custom analytics', included: true },
        { icon: Shield, text: 'Enterprise security', included: true },
        { icon: Headphones, text: 'Dedicated support', included: true }
      ]
    }
  };

  const currentPlan = user?.subscription_tier || 'free';

  const handlePlanSelect = (planKey) => {
    if (onSelectPlan) {
      onSelectPlan(planKey);
    } else {
      console.log('Selected plan:', planKey);
      alert(`Upgrade to ${planKey} plan - Payment integration would go here`);
    }
  };

  return (
    <div className="bg-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Choose the Right Plan for You
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Scale your voice AI operations with flexible pricing that grows with your business
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(plans).map(([planKey, plan]) => {
            const isCurrent = currentPlan === planKey;
            const isRecommended = highlightUpgrade && planKey === 'pro';

            return (
              <div
                key={planKey}
                className={`relative bg-white rounded-2xl border-2 p-8 ${isCurrent
                  ? 'border-green-500 shadow-lg'
                  : isRecommended
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                  } transition-all duration-200`}
              >
                {/* Popular Badge */}
                {(plan.popular || isRecommended) && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{isRecommended ? 'Recommended' : 'Most Popular'}</span>
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrent && showCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>

                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <li key={index} className="flex items-center space-x-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${feature.included
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                          }`}>
                          {feature.included ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-sm ${feature.included ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                          {feature.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Action Button */}
                <button
                  onClick={() => handlePlanSelect(planKey)}
                  disabled={isCurrent}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${isCurrent
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : isRecommended
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                >
                  {isCurrent ? 'Current Plan' : `Choose ${plan.name}`}
                </button>

                {/* Additional Info */}
                {planKey === 'enterprise' && (
                  <p className="text-center text-xs text-gray-500 mt-4">
                    Custom pricing available for higher volumes
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlans;