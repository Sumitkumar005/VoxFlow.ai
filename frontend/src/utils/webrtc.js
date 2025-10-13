/**
 * WebRTC utilities for browser-based voice calls
 */

/**
 * Request microphone permission and get audio stream
 */
export const getMicrophoneStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } 
    });
    return { success: true, stream };
  } catch (error) {
    console.error('Microphone access denied:', error);
    return { 
      success: false, 
      error: 'Microphone access denied. Please enable microphone permissions.' 
    };
  }
};

/**
 * Start recording audio from stream
 */
export const startRecording = (stream) => {
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000); // Collect data every second

  return {
    mediaRecorder,
    getAudioChunks: () => audioChunks,
  };
};

/**
 * Stop recording and get audio blob
 */
export const stopRecording = (mediaRecorder) => {
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(mediaRecorder.audioChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };
    mediaRecorder.stop();
  });
};

/**
 * Convert audio blob to base64
 */
export const audioBlobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Play audio from URL
 */
export const playAudio = (audioUrl) => {
  const audio = new Audio(audioUrl);
  audio.play();
  return audio;
};

/**
 * Check if browser supports WebRTC
 */
export const isWebRTCSupported = () => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
  );
};

/**
 * Stop all tracks in a media stream
 */
export const stopMediaStream = (stream) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};