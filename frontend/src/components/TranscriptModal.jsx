import { X, Download } from 'lucide-react';

const TranscriptModal = ({ transcript, runNumber, onClose }) => {
  const handleDownload = () => {
    const blob = new Blob([transcript.transcript_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${runNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Transcript Preview - Run #{runNumber}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
            {transcript.transcript_text}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button onClick={handleDownload} className="btn-primary">
            <Download size={18} className="inline mr-2" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptModal;