const { getFirstName } = require('./conversationTools');

/**
 * Helper function to validate if a string looks like a valid first name
 * 
 * @param {string} name - Name to validate
 * @returns {boolean} - True if name appears valid
 */
function isValidFirstName(name) {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 30) return false;
  
  // Must contain at least one alphabetic character
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  
  // Should not contain excessive special characters
  const specialCharCount = (trimmed.match(/[^a-zA-Z\s]/g) || []).length;
  if (specialCharCount > trimmed.length / 2) return false;
  
  return true;
}

module.exports = { 
  async extractFirstName(profilePage) {
    const timestamp = new Date().toISOString();
    try {
      console.log(`[${timestamp}] 🔍 Extracting first name from profile...`);
      const firstName = await getFirstName(profilePage);
      if (!firstName) {
        console.log(`[${timestamp}] ℹ️ No valid first name resolved`);
        return { firstName: '', success: false };
      }
      console.log(`[${timestamp}] ✅ Extracted first name: ${firstName}`);
      return { firstName, success: true };
    } catch (error) {
      console.error(`[${timestamp}] ❌ Error extracting first name:`, error.message);
      return { firstName: '', success: false };
    }
  },
  isValidFirstName 
};
