import { useState } from 'react';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

const CallInterface = ({ agentName, onStart, onEnd, isActive }) => {
  const [connecting, setConnecting] = useState(false);

  const handleStart = async () => {
    setConnecting(true);
    await onStart();
    setConnecting(false);
  };

  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {agentName}
        </h2>
        <p className="text-gray-600">
          {isActive ? 'Call in progress' : 'Ready to start call'}
        </p>
      </div>

      <div className="relative">
        {/* Animated waves when active */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute h-32 w-32 rounded-full bg-red-400 opacity-20 animate-ping" />
            <div className="absolute h-24 w-24 rounded-full bg-red-400 opacity-30 animate-ping" style={{ animationDelay: '0.2s' }} />
          </div>
        )}

        {/* Call button */}
        <button
          onClick={isActive ? onEnd : handleStart}
          disabled={connecting}
          className={`relative z-10 h-24 w-24 rounded-full flex items-center justify-center transition-all ${
            isActive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          } ${connecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {connecting ? (
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          ) : isActive ? (
            <PhoneOff className="h-10 w-10 text-white" />
          ) : (
            <Phone className="h-10 w-10 text-white" />
          )}
        </button>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        {connecting ? 'Establishing Connection...' : isActive ? 'Click to end call' : 'Click to start call'}
      </p>
    </div>
  );
};

export default CallInterface;