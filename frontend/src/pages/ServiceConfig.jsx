import { useState, useEffect } from 'react';
import { configAPI } from '../utils/api';
import { Settings, Loader2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const ServiceConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    llm_provider: 'groq',
    llm_model: 'llama-3.3-70b-versatile',
    tts_provider: 'deepgram',
    tts_voice: 'aura-2-helena-en',
    stt_provider: 'deepgram',
    stt_model: 'nova-3-general',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await configAPI.getService();
      if (response.data.data) {
        setFormData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await configAPI.saveService(formData);
      alert('Service configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Configuration</h1>
          <p className="text-gray-600">Configure your AI service providers</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* LLM Configuration */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">LLM Configuration</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                className="input-field"
                value={formData.llm_provider}
                onChange={(e) => setFormData({ ...formData, llm_provider: e.target.value })}
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="azure">Azure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                className="input-field"
                value={formData.llm_model}
                onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
              >
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                <option value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b</option>
              </select>
            </div>
          </div>
        </div>

        {/* TTS Configuration */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">TTS Configuration</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                className="input-field"
                value={formData.tts_provider}
                onChange={(e) => setFormData({ ...formData, tts_provider: e.target.value })}
              >
                <option value="deepgram">Deepgram</option>
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice
              </label>
              <select
                className="input-field"
                value={formData.tts_voice}
                onChange={(e) => setFormData({ ...formData, tts_voice: e.target.value })}
              >
                <option value="aura-2-helena-en">aura-2-helena-en</option>
                <option value="aura-2-thalia-en">aura-2-thalia-en</option>
              </select>
            </div>
          </div>
        </div>

        {/* STT Configuration */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">STT Configuration</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                className="input-field"
                value={formData.stt_provider}
                onChange={(e) => setFormData({ ...formData, stt_provider: e.target.value })}
              >
                <option value="deepgram">Deepgram</option>
                <option value="cartesia">Cartesia</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                className="input-field"
                value={formData.stt_model}
                onChange={(e) => setFormData({ ...formData, stt_model: e.target.value })}
              >
                <option value="nova-3-general">nova-3-general</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full btn-primary flex items-center justify-center"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Saving Configuration...
            </>
          ) : (
            'Save Configuration'
          )}
        </button>
      </form>
    </div>
  );
};

export default ServiceConfig;