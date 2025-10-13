import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI, callAPI } from '../utils/api';
import { ArrowLeft } from 'lucide-react';
import { getMicrophoneStream, stopMediaStream, playAudio } from '../utils/webrtc';
import CallInterface from '../components/CallInterface';
import LoadingSpinner from '../components/LoadingSpinner';

const WebCall = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [runId, setRunId] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    loadAgent();
  }, [id]);

  const loadAgent = async () => {
    try {
      const response = await agentAPI.getById(id);
      setAgent(response.data.data);
    } catch (error) {
      console.error('Failed to load agent:', error);
      alert('Failed to load agent');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async () => {
    try {
      setIsProcessing(true);

      // Check microphone permission
      const micResult = await getMicrophoneStream();
      if (!micResult.success) {
        alert(micResult.error);
        setIsProcessing(false);
        return;
      }

      // Stop the test stream
      stopMediaStream(micResult.stream);

      // Start call on backend
      const response = await callAPI.startWebCall({ agent_id: id });
      setRunId(response.data.data.run_id);
      setIsCallActive(true);
      setStartTime(Date.now());

      // Add initial greeting
      const greeting = `Hi, this call may be recorded for quality and training purposes. My name is Assistant, I'm with ${agent.use_case}. How can I help you today?`;

      setMessages([
        {
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Play greeting audio (text-to-speech simulation)
      await playGreeting(greeting);

      setIsProcessing(false);
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call: ' + error.message);
      setIsProcessing(false);
    }
  };

  const playGreeting = async (text) => {
    try {
      // Create a simple text-to-speech using browser's speech synthesis API (fallback)
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Failed to play greeting:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isProcessing || !isCallActive) return;

    setIsProcessing(true);
    const userMessage = userInput;
    setUserInput('');

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      // Send message to backend
      const response = await callAPI.processMessage({
        run_id: runId,
        message: userMessage,
        conversation_history: messages,
      });

      const aiMessage = response.data.data.message;

      // Add AI response to chat
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: aiMessage,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Play AI response using browser speech synthesis
      await playGreeting(aiMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = async () => {
    try {
      setIsProcessing(true);
      const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      await callAPI.endWebCall({
        run_id: runId,
        conversation_history: messages,
        duration_seconds: duration,
        disposition: 'user_hangup',
      });

      setIsCallActive(false);
      navigate(`/run/${runId}/completed`);
    } catch (error) {
      console.error('Failed to end call:', error);
      alert('Failed to end call');
      setIsProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(`/agents/${id}`)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Agent</span>
      </button>

      <div className="card">
        {!isCallActive ? (
          <CallInterface
            agentName={agent?.name || 'Voice Agent'}
            onStart={handleStartCall}
            onEnd={handleEndCall}
            isActive={false}
          />
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {agent?.name} - Call in Progress
              </h2>
              <button
                onClick={handleEndCall}
                disabled={isProcessing}
                className="btn-danger"
              >
                End Call
              </button>
            </div>

            {/* Chat Messages */}
            <div className="bg-gray-50 rounded-lg p-6 h-96 overflow-y-auto mb-6 space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No messages yet</p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-900 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="flex space-x-3">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Type your message and press Enter..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isProcessing) {
                    handleSendMessage();
                  }
                }}
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || !userInput.trim()}
                className="btn-primary px-6"
              >
                {isProcessing ? 'Sending...' : 'Send'}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              💡 Tip: The AI will respond with text-to-speech audio
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebCall;