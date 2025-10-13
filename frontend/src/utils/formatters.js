/**
 * Format date to readable string
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format datetime to readable string
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format duration in seconds to readable format
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '-';
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  // Format as +1 (555) 123-4567
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

/**
 * Format tokens to 2 decimal places
 */
export const formatTokens = (tokens) => {
  if (!tokens) return '0.00';
  return parseFloat(tokens).toFixed(2);
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Format disposition code to readable text
 */
export const formatDisposition = (disposition) => {
  if (!disposition) return 'Unknown';
  
  const dispositionMap = {
    'user_hangup': 'User Hangup',
    'user_idle_max_duration_exceeded': 'User Idle',
    'transfer_requested': 'Transfer Requested',
    'not_interested': 'Not Interested',
    'callback_requested': 'Callback Requested',
    'completed': 'Completed',
    'failed': 'Failed',
  };
  
  return dispositionMap[disposition] || disposition.replace(/_/g, ' ').toUpperCase();
};

/**
 * Get status badge color
 */
export const getStatusColor = (status) => {
  const colors = {
    'completed': 'bg-green-100 text-green-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'failed': 'bg-red-100 text-red-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'running': 'bg-blue-100 text-blue-800',
    'paused': 'bg-yellow-100 text-yellow-800',
    'stopped': 'bg-gray-100 text-gray-800',
    'created': 'bg-purple-100 text-purple-800',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
};