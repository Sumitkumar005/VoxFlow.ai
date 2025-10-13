import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { ArrowLeft, Loader2 } from 'lucide-react';

const CreateAgent = () => {
  const navigate = useNavigate();
  const { createAgent } = useAgent();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'OUTBOUND',
    use_case: '',
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await createAgent(formData);

    if (result.success) {
      navigate(`/agents/${result.data.id}`);
    }

    setLoading(false);
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Voice Agent</h1>
        <p className="text-gray-600 mb-6">
          Tell us about your use case and we'll create a customized Voice AI Agent for you
        </p>

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
              placeholder="e.g., Lead Qualification"
              value={formData.use_case}
              onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe what your Voice AI agent will do
            </label>
            <textarea
              className="input-field"
              rows="6"
              placeholder="Describe in detail what your agent should do, how it should behave, and what its goals are..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Creating Your VOICE AI AGENT...
              </>
            ) : (
              'Create VOICE AI AGENT'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAgent;