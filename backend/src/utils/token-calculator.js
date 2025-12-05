/**
 * Calculate Dograh tokens based on call duration
 * Formula: tokens = duration_seconds * 0.013
 */
export const calculateTokens = (durationSeconds) => {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0;
  }
  return parseFloat((durationSeconds * 0.013).toFixed(2));
};

/**
 * Generate unique run number
 * Format: WR-TEL-TIMESTAMP-XXXX
 */
export const generateRunNumber = () => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `WR-TEL-${timestamp}-${randomNum}`;
};