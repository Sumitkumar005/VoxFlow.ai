import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentAPI, usageAPI } from '../utils/api';
import { ArrowLeft, Phone, Globe, AlertTriangle, Sparkles, MessageSquare, PhoneCall, Target, Briefcase, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ApiKeyWarning from '../components/ApiKeyWarning';

const CreateAgent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'INBOUND',
    description: '',
    system_prompt: '',
    use_case: '',
    first_message: '',
  });

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const response = await usageAPI.getDashboard();
      setUsage(response.data.data?.current_usage);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const canCreateAgent = () => {
    if (!usage || !user) return true;
    return usage.agents < user.max_agents;
  };

  const handleTemplateSelect = (templateName) => {
    setSelectedTemplate(templateName);
    const template = templates.find(t => t.name === templateName);
    
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description,
        use_case: template.name,
        system_prompt: getTemplatePrompt(templateName),
        first_message: getTemplateFirstMessage(templateName),
      });
    }
  };

  const getTemplatePrompt = (templateName) => {
    const prompts = {
      'Customer Support': 'You are a helpful customer support agent. Listen carefully to customer issues, ask clarifying questions, and provide clear solutions. Be empathetic and professional.',
      'Sales Assistant': 'You are an enthusiastic sales assistant. Engage prospects warmly, understand their needs, highlight product benefits, and guide them toward making a purchase decision.',
      'Appointment Scheduler': 'You are an efficient appointment scheduler. Collect necessary information, check availability, confirm details, and book appointments professionally.',
      'Lead Qualifier': 'You are a lead qualification specialist. Ask targeted questions to understand prospect needs, budget, and timeline. Determine if they are a good fit and collect contact information.',
      'HR Assistant': 'You are a knowledgeable HR assistant. Answer employee questions about policies, benefits, leave, and procedures. Be helpful, accurate, and maintain confidentiality.',
    };
    return prompts[templateName] || '';
  };

  const getTemplateFirstMessage = (templateName) => {
    const messages = {
      'Customer Support': 'Hi! Thanks for reaching out. I\'m here to help you with any questions or issues. What can I assist you with today?',
      'Sales Assistant': 'Hello! Thanks for your interest. I\'d love to learn more about what you\'re looking for and show you how we can help. What brings you here today?',
      'Appointment Scheduler': 'Hi! I\'m here to help you schedule an appointment. What type of service are you interested in booking?',
      'Lead Qualifier': 'Hello! Thanks for your interest. I\'d like to learn more about your needs to see how we can best help you. Do you have a few minutes to chat?',
      'HR Assistant': 'Hi! I\'m your HR assistant. I can help you with questions about policies, benefits, leave requests, and more. What can I help you with?',
    };
    return messages[templateName] || '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canCreateAgent()) {
      if (window.confirm('You\'ve reached your agent limit. Would you like to upgrade your plan?')) {
        navigate('/upgrade?reason=agents&from=/agents/create');
      }
      return;
    }

    setLoading(true);

    try {
      const response = await agentAPI.create(formData);
      navigate(`/agents/${response.data.data.id}`);
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    { name: 'Customer Support', icon: MessageSquare, color: 'purple', description: 'Handle customer inquiries, troubleshoot issues, and provide helpful solutions' },
    { name: 'Sales Assistant', icon: Sparkles, color: 'teal', description: 'Engage prospects, answer questions, and guide them through the sales process' },
    { name: 'Appointment Scheduler', icon: PhoneCall, color: 'orange', description: 'Book appointments, manage calendars, and send confirmations automatically' },
    { name: 'Lead Qualifier', icon: Target, color: 'yellow', description: 'Engage prospects, ask qualifying questions, and pass on leads to your sales team' },
    { name: 'HR Assistant', icon: Briefcase, color: 'purple', description: 'Answer employee inquiries about policies, leave, and more while automating HR tasks' },
  ];

  const colorClasses = {
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    teal: 'from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    yellow: 'from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Agents</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Voice AI Agent</h1>
          <p className="text-gray-600">
            Create a professional voice AI agent optimized for natural conversations
          </p>
        </div>
        
        {/* Warnings */}
        <ApiKeyWarning className="mb-6" requiredProviders={['groq', 'deepgram']} />
        
        {/* Agent Limit Warning */}
        {usage && !canCreateAgent() && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-red-900 mb-1">Agent Limit Reached</h3>
                <p className="text-red-800 text-sm mb-3">
                  You've reached your limit of {user?.max_agents || 0} agents. 
                  Upgrade your plan to create more voice AI agents.
                </p>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigate('/upgrade?reason=agents&from=/agents/create')}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 text-sm"
                  >
                    Upgrade Plan
                  </button>
                  <span className="text-sm text-red-700">
                    Current: {usage.agents} / {user?.max_agents || 0} agents
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Agent Configuration</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Customer Support Agent"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INBOUND' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.type === 'INBOUND'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <Phone className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                    <div className="font-medium text-gray-900">Inbound</div>
                    <div className="text-xs text-gray-600 mt-1">Receives calls</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'OUTBOUND' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.type === 'OUTBOUND'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <Globe className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                    <div className="font-medium text-gray-900">Outbound</div>
                    <div className="text-xs text-gray-600 mt-1">Makes calls</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  placeholder="Brief description of what this agent does"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Case
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Customer Support, Sales, Scheduling"
                  value={formData.use_case}
                  onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt *
                </label>
                <textarea
                  className="input-field"
                  rows="4"
                  placeholder="Define the agent's personality, role, and behavior..."
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This defines how your agent will behave and respond
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Message
                </label>
                <textarea
                  className="input-field"
                  rows="2"
                  placeholder="The agent's greeting message..."
                  value={formData.first_message}
                  onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !canCreateAgent()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel - Templates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">Choose Templates</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Start with a pre-configured template and customize it to your needs
            </p>
            
            <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => handleTemplateSelect(template.name)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all group hover:shadow-md ${
                      selectedTemplate === template.name
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[template.color]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">
                          {template.name}
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center text-purple-600 text-sm font-medium">
                          <span>Try Now</span>
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAgent;
