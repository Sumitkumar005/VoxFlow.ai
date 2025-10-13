import fs from 'fs';
import path from 'path';
import { textToSpeech } from './deepgram.service.js';

/**
 * Generate recording from conversation history
 * This creates an audio file from the conversation transcript
 */
export const generateRecordingFromTranscript = async (conversationHistory, runId, voice) => {
  try {
    // Combine all assistant messages for TTS
    const assistantMessages = conversationHistory
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content)
      .join('. ');

    if (!assistantMessages) {
      return {
        success: false,
        error: 'No assistant messages to convert',
      };
    }

    // Generate audio using TTS
    const ttsResult = await textToSpeech(assistantMessages, voice);

    if (!ttsResult.success) {
      return {
        success: false,
        error: 'Failed to generate audio',
      };
    }

    // Save recording to file
    const recordingPath = path.join('uploads', 'recordings', `${runId}.mp3`);
    fs.writeFileSync(recordingPath, ttsResult.audio);

    return {
      success: true,
      recordingUrl: `/uploads/recordings/${runId}.mp3`,
      recordingPath,
    };
  } catch (error) {
    console.error('Recording generation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Save raw audio recording
 * For real WebRTC recordings
 */
export const saveAudioRecording = async (audioBuffer, runId, format = 'webm') => {
  try {
    const recordingPath = path.join('uploads', 'recordings', `${runId}.${format}`);
    fs.writeFileSync(recordingPath, audioBuffer);

    return {
      success: true,
      recordingUrl: `/uploads/recordings/${runId}.${format}`,
      recordingPath,
    };
  } catch (error) {
    console.error('Save recording error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Merge audio chunks into single file
 * For streaming recordings
 */
export const mergeAudioChunks = async (audioChunks, runId, format = 'wav') => {
  try {
    // Concatenate all buffers
    const mergedBuffer = Buffer.concat(audioChunks);

    const recordingPath = path.join('uploads', 'recordings', `${runId}.${format}`);
    fs.writeFileSync(recordingPath, mergedBuffer);

    return {
      success: true,
      recordingUrl: `/uploads/recordings/${runId}.${format}`,
      recordingPath,
      duration: calculateAudioDuration(mergedBuffer, format),
    };
  } catch (error) {
    console.error('Merge audio chunks error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Calculate audio duration from buffer
 * Approximate calculation
 */
const calculateAudioDuration = (audioBuffer, format) => {
  // Rough estimate: 16kHz, 16-bit, mono
  // Duration (seconds) = bytes / (sample_rate * bytes_per_sample * channels)
  const sampleRate = 16000; // 16kHz
  const bytesPerSample = 2; // 16-bit
  const channels = 1; // mono

  const duration = audioBuffer.length / (sampleRate * bytesPerSample * channels);
  return Math.round(duration);
};

/**
 * Delete recording file
 */
export const deleteRecording = async (recordingPath) => {
  try {
    if (fs.existsSync(recordingPath)) {
      fs.unlinkSync(recordingPath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Delete recording error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get recording file info
 */
export const getRecordingInfo = async (recordingPath) => {
  try {
    if (!fs.existsSync(recordingPath)) {
      return { success: false, error: 'Recording not found' };
    }

    const stats = fs.statSync(recordingPath);
    const extension = path.extname(recordingPath);

    return {
      success: true,
      info: {
        size: stats.size,
        format: extension.replace('.', ''),
        created: stats.birthtime,
        modified: stats.mtime,
      },
    };
  } catch (error) {
    console.error('Get recording info error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate dummy recording for testing
 */
export const generateDummyRecording = async (runId, durationSeconds = 10) => {
  try {
    // Create a simple text for dummy recording
    const dummyText = 'This is a test recording for the VoxFlow voice agent call.';
    
    const ttsResult = await textToSpeech(dummyText, 'aura-2-helena-en');

    if (!ttsResult.success) {
      // Fallback: create an empty file
      const recordingPath = path.join('uploads', 'recordings', `${runId}.mp3`);
      fs.writeFileSync(recordingPath, Buffer.from(''));
      
      return {
        success: true,
        recordingUrl: `/uploads/recordings/${runId}.mp3`,
        isDummy: true,
      };
    }

    const recordingPath = path.join('uploads', 'recordings', `${runId}.mp3`);
    fs.writeFileSync(recordingPath, ttsResult.audio);

    return {
      success: true,
      recordingUrl: `/uploads/recordings/${runId}.mp3`,
      recordingPath,
      isDummy: true,
    };
  } catch (error) {
    console.error('Generate dummy recording error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};