import { X, Download } from 'lucide-react';

const RecordingModal = ({ recordingUrl, runNumber, onClose }) => {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `recording-${runNumber}.mp3`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Recording Preview - Run #{runNumber}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <audio controls className="w-full">
            <source src={recordingUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
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

export default RecordingModal;