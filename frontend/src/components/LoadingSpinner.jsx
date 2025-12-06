import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 animate-fade-in">
      <div className="relative">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-purple-600`} />
        <div className="absolute inset-0 animate-ping opacity-20">
          <Loader2 className={`${sizeClasses[size]} text-purple-600`} />
        </div>
      </div>
      {message && (
        <p className="mt-4 text-gray-600 animate-pulse">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;