import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate AI response using Groq
 * @param {String} systemPrompt - Agent's system prompt/description
 * @param {Array} conversationHistory - Previous messages
 * @param {String} userMessage - Current user message
 * @param {String} model - Groq model to use
 */
export const generateResponse = async (
  systemPrompt,
  conversationHistory = [],
  userMessage,
  model = 'llama-3.3-70b-versatile'
) => {
  try {
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model,
      temperature: 0.7,
      max_tokens: 1024,
    });

    return {
      success: true,
      message: completion.choices[0]?.message?.content || '',
      usage: completion.usage,
    };
  } catch (error) {
    console.error('Groq API error:', error);
    return {
      success: false,
      error: error.message,
      message: 'I apologize, but I encountered an error. Please try again.',
    };
  }
};

/**
 * Stream AI response (for real-time conversation)
 */
export const streamResponse = async (
  systemPrompt,
  conversationHistory,
  userMessage,
  model = 'llama-3.3-70b-versatile'
) => {
  try {
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const stream = await groq.chat.completions.create({
      messages,
      model,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    return stream;
  } catch (error) {
    console.error('Groq streaming error:', error);
    throw error;
  }
};