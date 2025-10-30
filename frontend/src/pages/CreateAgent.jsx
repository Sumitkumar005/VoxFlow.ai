import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { ArrowLeft, Loader2, Lightbulb, Copy, Check, AlertTriangle } from 'lucide-react';
import { VOICE_AI_TEMPLATES, getAllTemplates, getTemplate, generateEnhancedPrompt } from '../utils/voiceAITemplates';
import ApiKeyWarning from '../components/ApiKeyWarning';
import { useAuth } from '../context/AuthContext';
import { usageAPI } from '../utils/api';

const CreateAgent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createAgent } = useAgent();
  const [loading, setLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [usage, setUsage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'OUTBOUND',
    use_case: '',
    description: '',
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
    if (!usage || !user) return true; // Allow if data not loaded yet
    return (usage.agents || 0) < (user.max_agents || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check agent limit before creating
    if (!canCreateAgent()) {
      navigate('/upgrade?reason=agents&from=/agents/create');
      return;
    }

    setLoading(true);

    // Enhance the description with voice AI best practices
    const enhancedDescription = generateEnhancedPrompt(
      formData.description,
      formData.use_case,
      formData.type
    );

    const result = await createAgent({
      ...formData,
      description: enhancedDescription,
    });

    if (result.success) {
      navigate(`/agents/${result.data.id}`);
    }

    setLoading(false);
  };

  const handleTemplateSelect = (templateName) => {
    const template = getTemplate(templateName);
    if (template) {
      setFormData({
        ...formData,
        use_case: template.useCase,
        description: template.description,
      });
      setSelectedTemplate(templateName);
      setShowTemplates(false);
    }
  };

  const copyTemplate = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Agents</span>
      </button>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Voice AI Agent</h1>
        <p className="text-gray-600 mb-4">
          Create a professional voice AI agent optimized for natural conversations
        </p>
        
        {/* API Key Warning */}
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
                    className="text-red-700 hover:text-red-900 text-sm font-medium underline"
                  >
                    Upgrade Plan →
                  </button>
                  <span className="text-red-600 text-sm">
                    Current: {usage?.agents || 0} / {user?.max_agents || 0} agents
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Voice AI Best Practices Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Lightbulb className="text-blue-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Voice AI Best Practices</h3>
              <p className="text-blue-800 text-sm mb-3">
                Following OpenAI's latest guidelines for optimal voice AI performance
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-medium text-blue-900 mb-1">✅ Do:</p>
                  <ul className="text-blue-800 space-y-1">
                    <li>• Keep responses short (1-2 sentences)</li>
                    <li>• Use natural, conversational language</li>
                    <li>• Ask one question at a time</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-900 mb-1">❌ Don't:</p>
                  <ul className="text-blue-800 space-y-1">
                    <li>• Use bullet points or lists</li>
                    <li>• Give long explanations</li>
                    <li>• Sound robotic or scripted</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selector */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <Lightbulb size={16} />
            <span>Use a Professional Template</span>
          </button>
          
          {showTemplates && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {getAllTemplates().map((templateName) => {
                const template = getTemplate(templateName);
                return (
                  <div
                    key={templateName}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => handleTemplateSelect(templateName)}
                  >
                    <h4 className="font-semibold text-gray-900 mb-2">{templateName}</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      {template.description.substring(0, 100)}...
                    </p>
                    <p className="text-xs text-blue-600 font-medium">Click to use this template</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Sales Qualification Agent"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Type
            </label>
            <select
              className="input-field"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="INBOUND">INBOUND</option>
              <option value="OUTBOUND">OUTBOUND</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              For the use case of
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Lead Qualification, Customer Support, Appointment Scheduling"
              value={formData.use_case}
              onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps categorize your agent and applies relevant best practices
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Voice AI Agent Instructions
              </label>
              {selectedTemplate && (
                <button
                  type="button"
                  onClick={() => copyTemplate(formData.description)}
                  className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  {copiedTemplate ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedTemplate ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>
            <textarea
              className="input-field"
              rows="8"
              placeholder="Describe your agent's role, goals, and conversation style. Be specific about what they should accomplish and how they should interact with callers..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
            <div className="mt-2 text-xs text-gray-500">
              <p className="mb-1">💡 <strong>Pro tip:</strong> Your description will be automatically enhanced with voice AI best practices</p>
              <p>Include: Role, goals, conversation style, and specific instructions for different scenarios</p>
            </div>
            
            {/* Live Preview */}
            {formData.description && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Preview: How users will see this agent</h4>
                <p className="text-sm text-blue-800">
                  {formData.description.length > 200 
                    ? formData.description.substring(0, 200) + '...'
                    : formData.description
                  }
                </p>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {selectedTemplate && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Template Preview: {selectedTemplate}</h4>
              <p className="text-sm text-gray-600 mb-3">
                Sample greeting this agent might use:
              </p>
              <div className="bg-white border border-gray-200 rounded p-3 text-sm italic text-gray-700">
                "{getTemplate(selectedTemplate)?.sampleGreeting}"
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canCreateAgent()}
            className={`w-full flex items-center justify-center ${
              canCreateAgent() 
                ? 'btn-primary' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Creating Your VOICE AI AGENT...
              </>
            ) : !canCreateAgent() ? (
              '🔒 Upgrade to Create More Agents'
            ) : (
              '🎤 Create VOICE AI AGENT'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAgent;