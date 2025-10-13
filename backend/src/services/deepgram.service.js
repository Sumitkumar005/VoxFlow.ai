import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

/**
 * Convert speech to text (STT)
 * @param {Buffer|String} audioSource - Audio buffer or file path
 * @param {String} model - STT model to use
 */
export const speechToText = async (audioSource, model = 'nova-3-general') => {
  try {
    let source;

    if (typeof audioSource === 'string') {
      // File path provided
      const audioBuffer = fs.readFileSync(audioSource);
      source = { buffer: audioBuffer, mimetype: 'audio/wav' };
    } else {
      // Buffer provided
      source = { buffer: audioSource, mimetype: 'audio/wav' };
    }

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      source.buffer,
      {
        model,
        smart_format: true,
        punctuate: true,
      }
    );

    if (error) {
      throw error;
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;

    return {
      success: true,
      transcript,
      confidence: result.results.channels[0].alternatives[0].confidence,
    };
  } catch (error) {
    console.error('Deepgram STT error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Convert text to speech (TTS)
 * @param {String} text - Text to convert
 * @param {String} voice - Voice model to use
 */
export const textToSpeech = async (text, voice = 'aura-2-helena-en') => {
  try {
    const response = await deepgram.speak.request(
      { text },
      {
        model: voice,
        encoding: 'mp3',
        container: 'mp3',
      }
    );

    const stream = await response.getStream();
    const buffer = await getAudioBuffer(stream);

    return {
      success: true,
      audio: buffer,
    };
  } catch (error) {
    console.error('Deepgram TTS error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Helper to convert stream to buffer
 */
const getAudioBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Live transcription (for real-time calls)
 */
export const startLiveTranscription = async () => {
  try {
    const connection = deepgram.listen.live({
      model: 'nova-3-general',
      language: 'en',
      smart_format: true,
      punctuate: true,
    });

    return connection;
  } catch (error) {
    console.error('Deepgram live transcription error:', error);
    throw error;
  }
};