import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone } from 'lucide-react';
import AudioWaveform from './AudioWaveform';

const VoiceVisualizer = ({
    isRecording,
    isAISpeaking,
    isProcessing,
    onToggleRecording,
    agentName,
    autoListenEnabled,
    onToggleAutoListen
}) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const [audioContext, setAudioContext] = useState(null);
    const [analyser, setAnalyser] = useState(null);
    const [dataArray, setDataArray] = useState(null);

    // Initialize audio context for visualization
    useEffect(() => {
        if (isRecording && !audioContext) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    const context = new (window.AudioContext || window.webkitAudioContext)();
                    const source = context.createMediaStreamSource(stream);
                    const analyserNode = context.createAnalyser();

                    analyserNode.fftSize = 256;
                    const bufferLength = analyserNode.frequencyBinCount;
                    const dataArr = new Uint8Array(bufferLength);

                    source.connect(analyserNode);

                    setAudioContext(context);
                    setAnalyser(analyserNode);
                    setDataArray(dataArr);
                })
                .catch(err => console.log('Audio context error:', err));
        }
    }, [isRecording, audioContext]);

    // Animation loop for visualizer
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (isRecording && analyser && dataArray) {
                // Real audio visualization
                analyser.getByteFrequencyData(dataArray);

                const radius = 80;
                const barCount = 32;

                for (let i = 0; i < barCount; i++) {
                    const angle = (i / barCount) * Math.PI * 2;
                    const barHeight = (dataArray[i] / 255) * 40 + 5;

                    const x1 = centerX + Math.cos(angle) * radius;
                    const y1 = centerY + Math.sin(angle) * radius;
                    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                    ctx.strokeStyle = `hsl(${120 + (dataArray[i] / 255) * 60}, 70%, 50%)`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            } else if (isAISpeaking) {
                // AI speaking animation
                const time = Date.now() * 0.005;
                const radius = 80;
                const barCount = 24;

                for (let i = 0; i < barCount; i++) {
                    const angle = (i / barCount) * Math.PI * 2;
                    const barHeight = Math.sin(time + i * 0.5) * 20 + 25;

                    const x1 = centerX + Math.cos(angle) * radius;
                    const y1 = centerY + Math.sin(angle) * radius;
                    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                    ctx.strokeStyle = `hsl(${240 + Math.sin(time + i) * 30}, 70%, 60%)`;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            } else if (isProcessing) {
                // Processing animation
                const time = Date.now() * 0.01;
                const radius = 80;
                const dots = 12;

                for (let i = 0; i < dots; i++) {
                    const angle = (i / dots) * Math.PI * 2 + time;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    const size = Math.sin(time * 2 + i) * 3 + 5;

                    ctx.fillStyle = `hsl(${45}, 70%, 60%)`;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Idle state - gentle pulse
                const time = Date.now() * 0.002;
                const radius = 80 + Math.sin(time) * 5;

                ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
                ctx.stroke();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isRecording, isAISpeaking, isProcessing, analyser, dataArray]);

    const getStatusText = () => {
        if (isAISpeaking) return `${agentName} is speaking...`;
        if (isRecording) return 'Listening to you...';
        if (isProcessing) return 'Processing your message...';
        return 'Ready to talk';
    };

    const getStatusColor = () => {
        if (isAISpeaking) return 'text-blue-600';
        if (isRecording) return 'text-green-600';
        if (isProcessing) return 'text-yellow-600';
        return 'text-gray-600';
    };

    return (
        <div className="flex flex-col items-center space-y-8 py-8">
            {/* Agent Avatar */}
            <div className="relative">
                {/* Main Avatar Circle */}
                <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isAISpeaking
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 scale-110'
                    : isRecording
                        ? 'bg-gradient-to-br from-green-500 to-green-600 scale-105'
                        : isProcessing
                            ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 animate-pulse'
                            : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner">
                        {isAISpeaking ? (
                            <Volume2 className="w-10 h-10 text-blue-600" />
                        ) : isRecording ? (
                            <Mic className="w-10 h-10 text-green-600" />
                        ) : isProcessing ? (
                            <div className="w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Phone className="w-10 h-10 text-gray-600" />
                        )}
                    </div>
                </div>

                {/* Animated Rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-40 h-40 rounded-full border-2 transition-all duration-500 ${isRecording
                        ? 'border-green-400 animate-ping'
                        : isAISpeaking
                            ? 'border-blue-400 animate-pulse'
                            : 'border-transparent'
                        }`} />
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-48 h-48 rounded-full border transition-all duration-700 ${isRecording
                        ? 'border-green-300 animate-ping'
                        : isAISpeaking
                            ? 'border-blue-300 animate-pulse'
                            : 'border-transparent'
                        }`} style={{ animationDelay: '0.5s' }} />
                </div>

                {/* Circular Visualizer */}
                <canvas
                    ref={canvasRef}
                    width={200}
                    height={200}
                    className="absolute inset-0 rounded-full"
                    style={{ top: '-34px', left: '-34px' }}
                />
            </div>

            {/* Audio Waveform */}
            <div className="w-full max-w-md">
                <AudioWaveform
                    isActive={isRecording || isAISpeaking || isProcessing}
                    type={isRecording ? 'listening' : isAISpeaking ? 'speaking' : 'processing'}
                    className="bg-gray-50 border border-gray-200"
                />
            </div>

            {/* Status Display */}
            <div className="text-center space-y-4">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-md mx-auto">
                    <h3 className={`text-2xl font-bold transition-colors duration-300 ${getStatusColor()}`}>
                        {getStatusText()}
                    </h3>
                    <p className="text-gray-500 text-sm mt-2">
                        {isRecording
                            ? 'Speak naturally, I\'m listening...'
                            : isAISpeaking
                                ? 'AI is responding to your message'
                                : isProcessing
                                    ? 'Analyzing your input...'
                                    : autoListenEnabled
                                        ? 'Auto-listen mode enabled'
                                        : 'Click to start conversation'
                        }
                    </p>

                    {/* Status Indicator Bar */}
                    <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${isRecording
                            ? 'bg-green-500 animate-pulse'
                            : isAISpeaking
                                ? 'bg-blue-500 animate-pulse'
                                : isProcessing
                                    ? 'bg-yellow-500 animate-pulse'
                                    : 'bg-gray-400'
                            }`} style={{
                                width: isRecording || isAISpeaking || isProcessing ? '100%' : '30%'
                            }} />
                    </div>
                </div>
            </div>

            {/* Professional Controls */}
            <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-6">
                    {/* Auto-listen Toggle */}
                    <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-700">Auto-listen</span>
                        <button
                            onClick={() => onToggleAutoListen(!autoListenEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${autoListenEnabled ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${autoListenEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    {/* Manual Record Button - Always show when not recording */}
                    {!isRecording && (
                        <button
                            onClick={onToggleRecording}
                            disabled={isProcessing || isAISpeaking}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                                isProcessing || isAISpeaking
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : autoListenEnabled
                                    ? 'bg-green-500 hover:bg-green-600 hover:scale-105 shadow-green-200'
                                    : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 shadow-blue-200'
                                }`}
                        >
                            <Mic className="w-6 h-6 text-white" />
                        </button>
                    )}
                    
                    {/* Stop Recording Button */}
                    {isRecording && (
                        <button
                            onClick={onToggleRecording}
                            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-red-500 hover:bg-red-600 scale-110 shadow-red-200"
                        >
                            <MicOff className="w-6 h-6 text-white" />
                        </button>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Connected</span>
                    </div>
                    <span>•</span>
                    <span>Real-time AI</span>
                    <span>•</span>
                    <span>HD Voice</span>
                    <span>•</span>
                    <span>Auto: {autoListenEnabled ? 'ON' : 'OFF'}</span>
                </div>
            </div>


        </div>
    );
};

export default VoiceVisualizer;