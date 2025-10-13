import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { callAPI } from '../utils/api';
import { CheckCircle, Download, Eye } from 'lucide-react';
import TranscriptModal from '../components/TranscriptModal';
import RecordingModal from '../components/RecordingModal';
import LoadingSpinner from '../components/LoadingSpinner';

const RunCompleted = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRecording, setShowRecording] = useState(false);

  useEffect(() => {
    loadRun();
  }, [runId]);

  const loadRun = async () => {
    try {
      const response = await callAPI.getRun(runId);
      setRun(response.data.data);
    } catch (error) {
      console.error('Failed to load run:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Processing your call..." />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card text-center">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Agent Run Completed
        </h1>
        <p className="text-gray-600 mb-8">
          Your voice agent run has been completed successfully. You can preview or download the transcript and recording.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setShowTranscript(true)}
            className="btn-primary flex items-center justify-center space-x-2"
          >
            <Eye size={18} />
            <span>Preview Transcript</span>
          </button>

          <button
            onClick={() => setShowRecording(true)}
            className="btn-primary flex items-center justify-center space-x-2"
          >
            <Eye size={18} />
            <span>Preview Recording</span>
          </button>
        </div>

        <button
          onClick={() => navigate(`/agents/${run?.agent_id}`)}
          className="btn-secondary"
        >
          Back to Agent
        </button>
      </div>

      {showTranscript && run && (
        <TranscriptModal
          transcript={run}
          runNumber={run.run_number}
          onClose={() => setShowTranscript(false)}
        />
      )}

      {showRecording && run && (
        <RecordingModal
          recordingUrl={run.recording_url || '/sample-recording.mp3'}
          runNumber={run.run_number}
          onClose={() => setShowRecording(false)}
        />
      )}
    </div>
  );
};

export default RunCompleted;