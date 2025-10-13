import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI, callAPI } from '../utils/api';
import { ArrowLeft, Mic } from 'lucide-react';
import { getMicrophoneStream, stopMediaStream } from '../utils/webrtc';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);

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

      // Get microphone permission and keep stream active
      const micResult = await getMicrophoneStream();
      if (!micResult.success) {
        alert(micResult.error);
        setIsProcessing(false);
        return;
      }

      setMediaStream(micResult.stream);

      // Start call on backend
      const response = await callAPI.startWebCall({ agent_id: id });
      setRunId(response.data.data.run_id);
      setIsCallActive(true);
      setStartTime(Date.now());

      // Add initial greeting using actual agent name
      const greeting = `Hi, this call may be recorded for quality and training purposes. My name is ${agent.name}, I'm with ${agent.use_case}. How can I help you today?`;

      setMessages([
        {
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Play greeting audio using browser speech synthesis
      await playGreeting(greeting);

      setIsProcessing(false);
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call: ' + error.message);
      setIsProcessing(false);
    }
  };

  const playGreeting = async (text) => {
    return new Promise((resolve) => {
      try {
        if ('speechSynthesis' in window) {
          setIsAISpeaking(true);

          // Get available voices and prefer a natural sounding one
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(voice =>
            voice.name.includes('Natural') ||
            voice.name.includes('Enhanced') ||
            voice.lang.startsWith('en-US')
          ) || voices[0];

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9; // Slightly slower for clarity
          utterance.pitch = 1;
          utterance.volume = 0.8;
          if (preferredVoice) utterance.voice = preferredVoice;

          utterance.onend = () => {
            setIsAISpeaking(false);
            // Auto-start listening after AI finishes speaking
            if (autoListenEnabled && isCallActive) {
              setTimeout(() => {
                startAutoListening();
              }, 800); // Slightly longer delay for better UX
            }
            resolve();
          };

          utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            setIsAISpeaking(false);
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        } else {
          console.warn('Speech synthesis not supported');
          resolve();
        }
      } catch (error) {
        console.error('Failed to play greeting:', error);
        setIsAISpeaking(false);
        resolve();
      }
    });
  };

  const startAutoListening = async () => {
    if (isRecording || isProcessing || isAISpeaking || !isCallActive) return;

    try {
      // Use browser's Web Speech API for speech recognition
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Speech recognition not supported in this browser.');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';
      let silenceTimer = null;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Clear existing silence timer
        if (silenceTimer) {
          clearTimeout(silenceTimer);
        }

        // If we have some speech, set a timer to process it after silence
        if (finalTranscript.trim() || interimTranscript.trim()) {
          silenceTimer = setTimeout(() => {
            if (finalTranscript.trim()) {
              recognition.stop();
              processVoiceMessage(finalTranscript.trim());
            }
          }, 2000); // 2 seconds of silence before processing
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (silenceTimer) clearTimeout(silenceTimer);

        // Auto-restart listening unless it's a critical error
        if (event.error !== 'aborted' && event.error !== 'not-allowed' && autoListenEnabled && isCallActive) {
          setTimeout(() => {
            startAutoListening();
          }, 1000);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (silenceTimer) clearTimeout(silenceTimer);
      };

      setMediaRecorder(recognition);
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsRecording(false);
    }
  };

  const handleStartRecording = () => {
    startAutoListening();
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.abort();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const processVoiceMessage = async (transcript) => {
    if (!transcript || isProcessing) return;

    setIsProcessing(true);

    try {
      // Add user message (transcript) to chat
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: transcript,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Send transcript to backend for AI response (filter out timestamps for Groq)
      const cleanHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await callAPI.processMessage({
        run_id: runId,
        message: transcript,
        conversation_history: cleanHistory,
      });

      const aiMessage = response.data.data.message;

      // Add AI response to chat
      if (aiMessage) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: aiMessage,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Play AI response using browser speech synthesis (will auto-start listening after)
        await playGreeting(aiMessage);
      }
    } catch (error) {
      console.error('Failed to process voice message:', error);
      alert(`${agent?.name || 'The agent'} had trouble processing your message. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = async () => {
    try {
      setIsProcessing(true);
      setAutoListenEnabled(false); // Disable auto-listening

      // Stop speech synthesis if active
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Stop recording if active
      if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        setIsRecording(false);
      }

      // Stop media stream
      if (mediaStream) {
        stopMediaStream(mediaStream);
        setMediaStream(null);
      }

      const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      // Clean conversation history for backend (remove timestamps)
      const cleanHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      await callAPI.endWebCall({
        run_id: runId,
        conversation_history: cleanHistory,
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

            {/* Voice Call Interface */}
            <div className="text-center py-8">
              <div className="mb-8">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                    {isAISpeaking ? (
                      <div className="w-6 h-6 bg-green-500 rounded-full animate-bounce"></div>
                    ) : isRecording ? (
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    ) : (
                      <Mic className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isAISpeaking ? 'AI Speaking...' : isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Ready to talk'}
                </h3>
                <p className="text-gray-600">
                  {isAISpeaking ? 'AI is responding to you' : isRecording ? 'Speak naturally, I\'m listening' : isProcessing ? 'Processing your message' : 'Continuous conversation mode'}
                </p>
              </div>

              {/* Auto-Listen Toggle */}
              <div className="flex items-center justify-center space-x-4 mb-4">
                <label className="flex items-center space-x-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={autoListenEnabled}
                    onChange={(e) => setAutoListenEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span>Auto-listen mode</span>
                </label>
              </div>

              {/* Status Indicator */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl transition-all duration-200 mx-auto ${isAISpeaking
                ? 'bg-green-500 animate-bounce'
                : isRecording
                  ? 'bg-red-500 scale-110 shadow-lg animate-pulse'
                  : isProcessing
                    ? 'bg-yellow-500 animate-spin'
                    : 'bg-blue-500 shadow-md'
                }`}>
                {isAISpeaking ? '🔊' : isRecording ? <Mic /> : isProcessing ? '⚡' : <Mic />}
              </div>

              <p className="text-sm text-gray-500 mt-4">
                {isAISpeaking
                  ? 'AI is speaking...'
                  : isRecording
                    ? 'Listening... (speak naturally)'
                    : isProcessing
                      ? 'Processing your message...'
                      : autoListenEnabled
                        ? 'Auto-listening enabled - just speak!'
                        : 'Manual mode - click to start listening'
                }
              </p>

              {!autoListenEnabled && (
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={isProcessing || isAISpeaking}
                  className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {isRecording ? 'Stop Listening' : 'Start Listening'}
                </button>
              )}
            </div>

            {/* Conversation History */}
            {messages.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${msg.role === 'user'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-gray-200 text-gray-900'
                          }`}
                      >
                        <p className="font-medium text-xs mb-1">
                          {msg.role === 'user' ? 'You' : 'Agent'}
                        </p>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-6 text-center">
              🎤 Real Voice AI Call - Continuous conversation mode enabled. Just speak naturally!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebCall;