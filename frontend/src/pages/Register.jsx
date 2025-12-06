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
    <div className="min-h-screen flex" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Left Side - Image Only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img 
          src="/login-page-leftside-half.png" 
          alt="VoxFlow Background" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-md w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl mb-3 shadow-lg shadow-purple-500/30">
              <Zap className="h-7 w-7" style={{ color: '#FFFFFF' }} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              VoxFlow
            </h1>
          </div>

          <div className="rounded-2xl shadow-xl border border-gray-100 p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Account</h2>
              <p className="text-sm text-gray-600">Start your voice AI journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Organization (Optional)
                </label>
                <div className="relative">
                  <Building className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Your Company"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>

                {/* Password Requirements */}
                {formData.password && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
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
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Choose Your Plan
                </label>
                <div className="space-y-1.5">
                  {subscriptionTiers.map((tier) => (
                    <div
                      key={tier.value}
                      className={`relative border-2 rounded-lg p-2.5 cursor-pointer transition-all ${
                        formData.subscription_tier === tier.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => setFormData({ ...formData, subscription_tier: tier.value })}
                    >
                      {tier.popular && (
                        <span className="absolute -top-1.5 right-3 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                          Popular
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="subscription_tier"
                            value={tier.value}
                            checked={formData.subscription_tier === tier.value}
                            onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                            className="text-purple-600"
                          />
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{tier.name}</h3>
                            <p className="text-xs text-gray-500">{tier.features.join(' • ')}</p>
                          </div>
                        </div>
                        <span className="text-base font-bold text-purple-600">{tier.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-lg text-xs flex items-start space-x-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className="w-full py-2.5 text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
                  Sign In
                </Link>
              </p>
            </div>

            <div className="mt-3 text-center text-xs text-gray-500">
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
