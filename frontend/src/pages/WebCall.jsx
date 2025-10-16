import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentAPI, callAPI } from '../utils/api';
import { ArrowLeft } from 'lucide-react';
import { getMicrophoneStream, stopMediaStream } from '../utils/webrtc';
import CallInterface from '../components/CallInterface';
import LoadingSpinner from '../components/LoadingSpinner';
import VoiceVisualizer from '../components/VoiceVisualizer';

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

  // Use refs to track the latest state values for async operations
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isAISpeakingRef = useRef(false);
  const autoListenEnabledRef = useRef(true);
  const isCallActiveRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recognitionInstanceRef = useRef(null);
  const autoListenTimeoutRef = useRef(null);

  // Sync refs with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isAISpeakingRef.current = isAISpeaking;
  }, [isAISpeaking]);

  useEffect(() => {
    autoListenEnabledRef.current = autoListenEnabled;
  }, [autoListenEnabled]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

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
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.volume = 0.8;
          if (preferredVoice) utterance.voice = preferredVoice;

          utterance.onend = () => {
            setIsAISpeaking(false);
            // Schedule auto-listen after AI finishes speaking
            scheduleAutoListen();
            resolve();
          };

          utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            setIsAISpeaking(false);
            scheduleAutoListen();
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

  // Centralized function to schedule auto-listen with proper cleanup
  const scheduleAutoListen = () => {
    // Clear any existing timeout
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }

    // Only schedule if auto-listen is enabled
    if (!autoListenEnabledRef.current || !isCallActiveRef.current) {
      console.log('Auto-listen scheduling skipped:', {
        autoEnabled: autoListenEnabledRef.current,
        callActive: isCallActiveRef.current
      });
      return;
    }

    console.log('Scheduling auto-listen in 1500ms...');
    autoListenTimeoutRef.current = setTimeout(() => {
      startAutoListening();
    }, 1500); // Single consistent delay
  };

  const startAutoListening = async () => {
    console.log('startAutoListening called', {
      isRecording: isRecordingRef.current,
      isProcessing: isProcessingRef.current,
      isAISpeaking: isAISpeakingRef.current,
      isCallActive: isCallActiveRef.current,
      autoListenEnabled: autoListenEnabledRef.current
    });

    // Use refs for real-time state check
    if (isRecordingRef.current || isProcessingRef.current || isAISpeakingRef.current || !isCallActiveRef.current) {
      console.log('Auto-listen blocked by state');
      return;
    }

    if (!autoListenEnabledRef.current) {
      console.log('Auto-listen disabled');
      return;
    }

    // Stop any existing recognition instance
    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.abort();
      } catch (e) {
        console.log('Error aborting existing recognition:', e);
      }
      recognitionInstanceRef.current = null;
    }

    try {
      // Use browser's Web Speech API for speech recognition
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Speech recognition not supported in this browser.');
        alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
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
        console.log('Speech recognition started');
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

        // Clean up reference
        if (recognitionInstanceRef.current === recognition) {
          recognitionInstanceRef.current = null;
        }

        // Auto-restart listening unless it's a critical error
        if (event.error !== 'aborted' && event.error !== 'not-allowed') {
          scheduleAutoListen();
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
        if (silenceTimer) clearTimeout(silenceTimer);

        // Clean up reference
        if (recognitionInstanceRef.current === recognition) {
          recognitionInstanceRef.current = null;
        }
      };

      // Store references
      setMediaRecorder(recognition);
      recognitionInstanceRef.current = recognition;
      mediaRecorderRef.current = recognition;

      console.log('Starting speech recognition...');
      recognition.start();

    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsRecording(false);

      // Retry after error if auto-listen is still enabled
      if (autoListenEnabledRef.current && isCallActiveRef.current) {
        scheduleAutoListen();
      }
    }
  };

  const handleStartRecording = () => {
    console.log('Manual recording start requested');
    // Clear any pending auto-listen
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }
    startAutoListening();
  };

  const handleStopRecording = () => {
    console.log('Stopping recording...');

    // Clear any pending auto-listen
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }

    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
      recognitionInstanceRef.current = null;
    }

    if (mediaRecorder && isRecording) {
      try {
        mediaRecorder.abort();
      } catch (e) {
        console.log('Error aborting mediaRecorder:', e);
      }
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const processVoiceMessage = async (transcript) => {
    if (!transcript || isProcessingRef.current) {
      console.log('Process blocked:', { transcript: !!transcript, isProcessing: isProcessingRef.current });
      return;
    }

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

        // Play AI response (will auto-schedule listening after via playGreeting's onend)
        await playGreeting(aiMessage);
      }
    } catch (error) {
      console.error('Failed to process voice message:', error);
      alert(`${agent?.name || 'The agent'} had trouble processing your message. Please try again.`);
      // Schedule auto-listen even after error if enabled
      scheduleAutoListen();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = async () => {
    try {
      setIsProcessing(true);
      setAutoListenEnabled(false);

      // Clear any pending auto-listen
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
        autoListenTimeoutRef.current = null;
      }

      // Stop speech synthesis if active
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Stop recording if active
      if (recognitionInstanceRef.current) {
        try {
          recognitionInstanceRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on end call:', e);
        }
        recognitionInstanceRef.current = null;
      }

      if (isRecording && mediaRecorder) {
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.log('Error stopping mediaRecorder on end call:', e);
        }
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

  // Debug function - expose to window for testing
  useEffect(() => {
    window.debugVoxFlow = {
      startListening: startAutoListening,
      stopListening: handleStopRecording,
      scheduleAutoListen: scheduleAutoListen,
      currentState: {
        isRecording: isRecordingRef.current,
        isProcessing: isProcessingRef.current,
        isAISpeaking: isAISpeakingRef.current,
        autoListenEnabled: autoListenEnabledRef.current,
        isCallActive: isCallActiveRef.current
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
      if (recognitionInstanceRef.current) {
        try {
          recognitionInstanceRef.current.stop();
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }
    };
  }, []);

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

            {/* Professional Voice Visualizer */}
            <VoiceVisualizer
              isRecording={isRecording}
              isAISpeaking={isAISpeaking}
              isProcessing={isProcessing}
              onToggleRecording={() => {
                if (isRecording) {
                  handleStopRecording();
                } else {
                  handleStartRecording();
                }
              }}
              agentName={agent?.name || 'Agent'}
              autoListenEnabled={autoListenEnabled}
              onToggleAutoListen={(enabled) => {
                console.log('Auto-listen toggled:', enabled);
                setAutoListenEnabled(enabled);

                // Clear any pending auto-listen when toggling
                if (autoListenTimeoutRef.current) {
                  clearTimeout(autoListenTimeoutRef.current);
                  autoListenTimeoutRef.current = null;
                }

                // If enabling and ready, schedule auto-listen
                if (enabled && isCallActive && !isRecording && !isProcessing && !isAISpeaking) {
                  console.log('Scheduling auto-listen after toggle...');
                  scheduleAutoListen();
                }

                // If disabling, stop any active recording
                if (!enabled && isRecording) {
                  handleStopRecording();
                }
              }}
            />

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