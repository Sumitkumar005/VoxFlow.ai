/**
 * Agent utility functions for processing and displaying agent data
 */

/**
 * Extract user-friendly description from complex AI prompt
 * @param {String} fullDescription - The complete AI prompt
 * @returns {String} - Clean, user-friendly description
 */
export const extractUserFriendlyDescription = (fullDescription) => {
  if (!fullDescription) return 'No description available';
  
  // If it's already a simple description (doesn't contain OpenAI structure)
  if (!fullDescription.includes('# Role & Objective') && !fullDescription.includes('# Personality & Tone')) {
    return fullDescription.length > 200 
      ? fullDescription.substring(0, 200) + '...'
      : fullDescription;
  }
  
  // Extract the main description from OpenAI-structured prompt
  const lines = fullDescription.split('\n');
  let description = '';
  let capturing = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Start capturing after "Your task is to" or similar
    if (trimmedLine.includes('Your task is to') || 
        trimmedLine.includes('You are a') ||
        (trimmedLine.length > 20 && !trimmedLine.startsWith('#') && !capturing && description === '')) {
      capturing = true;
      description += trimmedLine + ' ';
      continue;
    }
    
    // Stop capturing when we hit a new section
    if (capturing && (trimmedLine.startsWith('#') || trimmedLine.startsWith('##'))) {
      break;
    }
    
    // Continue capturing if we're in the description section
    if (capturing && trimmedLine.length > 0 && !trimmedLine.startsWith('-')) {
      description += trimmedLine + ' ';
    }
  }
  
  // Clean up the description
  description = description
    .replace(/\s+/g, ' ')
    .trim();
  
  // If we couldn't extract a good description, create a generic one
  if (!description || description.length < 20) {
    // Try to extract use case information
    const useCaseMatch = fullDescription.match(/specialized in ([^.]+)/i);
    if (useCaseMatch) {
      description = `Professional voice AI agent specialized in ${useCaseMatch[1].toLowerCase()}.`;
    } else {
      description = 'Professional voice AI agent for business communications.';
    }
  }
  
  // Limit length for display
  if (description.length > 200) {
    description = description.substring(0, 200) + '...';
  }
  
  return description;
};

/**
 * Get agent type display name
 * @param {String} type - Agent type (INBOUND/OUTBOUND)
 * @returns {String} - Display-friendly type name
 */
export const getAgentTypeDisplay = (type) => {
  const typeMap = {
    'INBOUND': 'Inbound',
    'OUTBOUND': 'Outbound'
  };
  return typeMap[type] || type;
};

/**
 * Get agent type color classes
 * @param {String} type - Agent type (INBOUND/OUTBOUND)
 * @returns {String} - CSS classes for styling
 */
export const getAgentTypeClasses = (type) => {
  const classMap = {
    'INBOUND': 'bg-green-100 text-green-800',
    'OUTBOUND': 'bg-blue-100 text-blue-800'
  };
  return classMap[type] || 'bg-gray-100 text-gray-800';
};

/**
 * Generate a summary for agent capabilities
 * @param {Object} agent - Agent object
 * @returns {String} - Capability summary
 */
export const generateAgentSummary = (agent) => {
  const type = agent.type?.toLowerCase() || 'voice';
  const useCase = agent.use_case || 'general assistance';
  
  return `${getAgentTypeDisplay(agent.type)} voice AI agent for ${useCase.toLowerCase()}. Designed for professional, natural conversations.`;
};

/**
 * Check if description is a complex AI prompt
 * @param {String} description - Agent description
 * @returns {Boolean} - True if it's a complex prompt
 */
export const isComplexPrompt = (description) => {
  if (!description) return false;
  
  return description.includes('# Role & Objective') || 
         description.includes('# Personality & Tone') ||
         description.includes('# Instructions/Rules') ||
         description.length > 500;
};