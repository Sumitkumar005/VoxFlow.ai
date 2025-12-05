import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Loader2, Mail, Lock, Eye, EyeOff, CheckCircle, XCircle, Building, ArrowRight, Sparkles } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    organization_name: '',
    subscription_tier: 'free',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  const validatePassword = (password) => {
    const validation = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
    };
    setPasswordValidation(validation);
    return Object.values(validation).every(Boolean);
  };

  const handlePasswordChange = (password) => {
    setFormData({ ...formData, password });
    validatePassword(password);
  };

  const isFormValid = () => {
    return (
      formData.email &&
      formData.password &&
      formData.confirmPassword &&
      formData.password === formData.confirmPassword &&
      Object.values(passwordValidation).every(Boolean)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFormValid()) {
      setError('Please fill in all fields correctly');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const result = await register({
      email: formData.email,
      password: formData.password,
      organization_name: formData.organization_name || undefined,
      subscription_tier: formData.subscription_tier,
    });

    if (result.success) {
      navigate('/agents');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  const subscriptionTiers = [
    {
      value: 'free',
      name: 'Free',
      price: '$0',
      features: ['2 AI agents', '1,000 tokens/month', 'Web calls only'],
    },
    {
      value: 'pro',
      name: 'Pro',
      price: '$29',
      features: ['10 AI agents', '50,000 tokens/month', 'Phone calls'],
      popular: true,
    },
    {
      value: 'enterprise',
      name: 'Enterprise',
      price: '$299',
      features: ['100 AI agents', '1M tokens/month', 'Custom integrations'],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 to-purple-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">VoxFlow</span>
              <p className="text-purple-200 text-sm">Voice AI Platform</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Start Building Voice AI Agents Today
              </h1>
              <p className="text-purple-100 text-lg">
                Join thousands of businesses using VoxFlow to automate voice interactions
              </p>
            </div>

            <div className="space-y-4">
              {[
                'Create unlimited voice agents',
                'Deploy in minutes, not days',
                'Scale to millions of calls',
                'Enterprise-grade security'
              ].map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 text-purple-200 text-sm">
          © 2024 VoxFlow. All rights reserved.
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-md w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl mb-4 shadow-lg shadow-purple-500/30">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              VoxFlow
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
              <p className="text-gray-600">Start your voice AI journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization (Optional)
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Your Company"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>

                {/* Password Requirements */}
                {formData.password && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { key: 'length', label: '8+ characters' },
                      { key: 'uppercase', label: 'Uppercase' },
                      { key: 'lowercase', label: 'Lowercase' },
                      { key: 'number', label: 'Number' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center text-xs">
                        {passwordValidation[key] ? (
                          <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 text-gray-300 mr-1" />
                        )}
                        <span className={passwordValidation[key] ? 'text-green-600' : 'text-gray-500'}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Choose Your Plan
                </label>
                <div className="space-y-2">
                  {subscriptionTiers.map((tier) => (
                    <div
                      key={tier.value}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        formData.subscription_tier === tier.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => setFormData({ ...formData, subscription_tier: tier.value })}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2 right-4 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                          Popular
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="subscription_tier"
                            value={tier.value}
                            checked={formData.subscription_tier === tier.value}
                            onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                            className="text-purple-600"
                          />
                          <div>
                            <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                            <p className="text-xs text-gray-500">{tier.features.join(' • ')}</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-purple-600">{tier.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm flex items-start space-x-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Create Account</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
                  Sign In
                </Link>
              </p>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              By creating an account, you agree to our{' '}
              <a href="#" className="text-purple-600 hover:underline">Terms</a>
              {' '}and{' '}
              <a href="#" className="text-purple-600 hover:underline">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
