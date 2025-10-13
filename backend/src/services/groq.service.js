import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Enhanced Voice AI prompt builder following OpenAI's official prompting guide
 * Implements the complete structure and best practices from OpenAI's documentation
 * @param {String} agentDescription - User's agent description
 * @param {String} agentType - INBOUND or OUTBOUND
 * @param {String} useCase - Agent's use case
 * @param {Object} context - Additional context (caller info, etc.)
 */
const buildVoiceAIPrompt = (agentDescription, agentType, useCase, agentName, context = {}) => {
  const prompt = `# Role & Objective
You are a professional ${agentType.toLowerCase()} voice AI agent specialized in ${useCase}.
${agentName ? `Your name is ${agentName}.` : ''}
Your task is to ${agentType === 'INBOUND' ? 'assist callers who contact you' : 'engage with people you call'} in a natural, helpful conversation.

${agentDescription}

# Personality & Tone
## Personality
- Friendly, calm and approachable professional
- Confident but never pushy or aggressive
- Genuinely interested in helping the caller

## Tone
- Warm, concise, confident, never fawning
- Natural and conversational, not robotic
- Professional but human

## Length
- 1-2 sentences per turn maximum
- Keep responses brief and focused
- Don't over-explain or ramble

## Pacing
- Deliver your audio response at a natural pace
- Don't sound rushed or hurried
- Use natural pauses and rhythm

## Language
- The conversation will be only in English
- Do not respond in any other language even if the user asks
- If the user speaks another language, politely explain that support is limited to English

## Variety
- Do not repeat the same sentence twice
- Vary your responses so it doesn't sound robotic
- Use different phrases and sentence structures
- Avoid repetitive openings or closings

# Instructions/Rules
## Response Guidelines
- Keep responses SHORT (1-2 sentences maximum)
- Use natural, conversational language with contractions (I'm, you're, we'll, can't)
- Ask ONE question at a time and wait for responses
- Use active listening phrases ("I see", "That makes sense", "Got it")
- Acknowledge what the person said before moving forward

## Voice-Optimized Language
- Avoid bullet points, lists, or formatting in responses
- Use simple, clear words - avoid jargon or complex terms
- When reading numbers, speak each digit separately with hyphens (e.g., "4-1-5")
- Spell out important information clearly

## Conversation Management
- Stay focused on the conversation goal
- Handle interruptions gracefully - acknowledge and adapt
- Don't repeat information already covered
- Stay flexible with conversation direction
- End responses in a way that invites natural continuation

## Unclear Audio Handling
- Only respond to clear audio or text
- If the user's audio is not clear (background noise/silent/unintelligible), ask for clarification
- Use phrases like "I'm sorry, I didn't catch that. Could you repeat it?" or "Could you say that again?"

## Professional Behavior
- Be warm but professional at all times
- Show genuine interest in their responses
- Use their name when appropriate and natural
- Handle objections or concerns gracefully
- Never argue or become defensive

# Context
${context.callerName ? `- Caller Name: ${context.callerName}` : ''}
${context.companyName ? `- Company: ${context.companyName}` : ''}
${context.callType ? `- Call Type: ${context.callType}` : ''}
${context.previousInteraction ? `- Previous Interaction: ${context.previousInteraction}` : ''}

# Safety & Escalation
- If the caller becomes abusive, threatening, or inappropriate, politely end the call
- If you cannot help with their request, offer to connect them with someone who can
- If technical issues arise, acknowledge them and suggest alternatives
- Never provide information you're not certain about

# Conversation Flow
## Opening
- Start with a brief, friendly greeting
- Identify yourself and your purpose clearly
- Ask how you can help or state your reason for calling

## Discovery
- Listen actively to understand their needs
- Ask clarifying questions one at a time
- Confirm your understanding before proceeding

## Resolution
- Provide clear, actionable information or assistance
- Confirm they understand and are satisfied
- Offer next steps if appropriate

## Closing
- Summarize what was accomplished
- Ask if there's anything else you can help with
- End on a positive, professional note

CRITICAL REMINDERS:
- This is a VOICE conversation - sound natural and human
- Never use formatting, bullet points, or lists in your spoken responses
- Keep it conversational, brief, and focused
- You're talking to a real person - be genuine and helpful`;

  return prompt;
};

/**
 * Generate AI response using Groq with enhanced voice AI prompting
 * @param {String} agentDescription - Agent's description from user
 * @param {Array} conversationHistory - Previous messages
 * @param {String} userMessage - Current user message
 * @param {String} model - Groq model to use
 * @param {Object} agentConfig - Agent configuration (type, use_case, etc.)
 * @param {Object} context - Additional context
 */
export const generateResponse = async (
  agentDescription,
  conversationHistory = [],
  userMessage,
  model = 'llama-3.3-70b-versatile',
  agentConfig = {},
  context = {}
) => {
  try {
    // Build enhanced voice AI prompt
    const enhancedPrompt = buildVoiceAIPrompt(
      agentDescription,
      agentConfig.type || 'OUTBOUND',
      agentConfig.use_case || 'General Assistance',
      agentConfig.name || null,
      context
    );

    const messages = [
      {
        role: 'system',
        content: enhancedPrompt,
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
      temperature: 0.7, // Balanced for natural but consistent responses
      max_tokens: 100, // Very short responses for voice (1-2 sentences)
      top_p: 0.9,
      frequency_penalty: 0.3, // Higher to reduce repetition (OpenAI guideline)
      presence_penalty: 0.2, // Encourage variety in responses
      stop: ['\n\n', '---', '###'], // Stop at formatting markers
    });

    let response = completion.choices[0]?.message?.content || '';

    // Post-process response for voice optimization
    response = optimizeForVoice(response);

    return {
      success: true,
      message: response,
      usage: completion.usage,
    };
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Generate agent-aware error message
    const agentName = agentConfig.name || 'I';
    const errorMessages = [
      `Sorry, ${agentName === 'I' ? 'I' : agentName} didn't catch that clearly. Could you repeat it?`,
      `${agentName === 'I' ? 'I' : agentName} had trouble processing that. Can you say it again?`,
      `Apologies, ${agentName === 'I' ? 'I' : agentName} missed what you said. Please try again.`
    ];
    
    const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    
    return {
      success: false,
      error: error.message,
      message: randomMessage,
    };
  }
};

/**
 * Optimize response text for voice delivery following OpenAI's guidelines
 * @param {String} text - Raw AI response
 * @returns {String} - Voice-optimized response
 */
const optimizeForVoice = (text) => {
  let optimized = text
    // Remove all markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')

    // Remove bullet points and numbered lists completely
    .replace(/^[-•*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[a-zA-Z]\.\s+/gm, '')

    // Remove section headers and formatting
    .replace(/^##?\s+.*$/gm, '')
    .replace(/^---+$/gm, '')

    // Clean up whitespace and line breaks
    .replace(/\n\s*\n/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

    // Fix common voice issues
    .replace(/\b(URL|API|ID|FAQ|CEO|CTO|AI|ML|UI|UX)\b/g, (match) => {
      // Convert acronyms to speakable format
      const acronymMap = {
        'URL': 'U-R-L',
        'API': 'A-P-I',
        'ID': 'I-D',
        'FAQ': 'F-A-Q',
        'CEO': 'C-E-O',
        'CTO': 'C-T-O',
        'AI': 'A-I',
        'ML': 'M-L',
        'UI': 'U-I',
        'UX': 'U-X'
      };
      return acronymMap[match] || match;
    })

    // Format numbers for voice (phone numbers, etc.)
    .replace(/\b(\d{3})[-.]?(\d{3})[-.]?(\d{4})\b/g, '$1-$2-$3')
    .replace(/\b(\d{10,})\b/g, (match) => {
      // Break long numbers into groups
      return match.split('').join('-');
    })

    // Ensure proper sentence structure
    .replace(/([^.!?])\s*$/, '$1.')
    .replace(/\.\s*\./g, '.')

    // Remove parenthetical information that's hard to speak
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')

    // Clean up extra punctuation
    .replace(/[;:]/g, ',')
    .replace(/,+/g, ',')
    .replace(/\.+/g, '.')

    // Final cleanup
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce length limits (OpenAI recommends 1-2 sentences)
  const sentences = optimized.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (sentences.length > 2) {
    optimized = sentences.slice(0, 2).join('. ') + '.';
  }

  // Ensure it ends properly
  if (optimized && !optimized.match(/[.!?]$/)) {
    optimized += '.';
  }

  return optimized;
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