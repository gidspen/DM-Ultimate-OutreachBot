// conversationDetector.js
// Instagram DM conversation detection module
// This file does NOT contain any credentials or secrets - all credentials are loaded from environment variables
const { humanDelay, ts } = require('./utils');

async function detectExistingConversation(dmPage) {
  console.log(`[${ts()}] 🧩 Starting refined conversation detection...`);

  try {
    await humanDelay(250, 500, 'before scanning conversation thread');

    // --- Step 1: Detect Layout ---
    const isModal = await dmPage.$('div[role="dialog"]');
    const isFullPage = await dmPage.$('div[role="presentation"]');
    
    let containerSelector;
    if (isModal) {
      containerSelector = 'div[aria-label="Chat details"], div[role="none"]:has(span[dir="auto"])';
    } else if (isFullPage) {
      containerSelector = 'div[role="none"]:has(span[dir="auto"])';
    } else {
      // Fallback to general message container
      containerSelector = 'div[role="none"]:has(span[dir="auto"]), div[aria-label="Chat details"]';
    }
    
    console.log(`[${ts()}] 🔍 Detected ${isModal ? 'modal' : isFullPage ? 'full-page' : 'unknown'} DM layout`);

    // --- Step 2: Extract Candidate Messages ---
    const rawCandidates = await dmPage.$$eval(`${containerSelector} div[dir="auto"], ${containerSelector} span[dir="auto"]`, elements => {
      return elements.map(el => {
        const text = el.innerText?.trim() || '';
        const isInHeader = el.closest('[role="banner"], [aria-label*="profile"]') !== null;
        const parentAria = el.closest('[aria-label]')?.getAttribute('aria-label') || '';
        
        return {
          text,
          isInHeader,
          parentAria,
          element: el.tagName
        };
      });
    });

    console.log(`[conversationDetector] Raw candidates: ${rawCandidates.length}`);

    // --- Step 3: Filter out non-message elements ---
    const filteredCandidates = rawCandidates.filter(candidate => {
      const text = candidate.text;
      
      // Skip empty or whitespace-only text
      if (!text || text.trim().length === 0) return false;
      
      // Skip elements in header sections
      if (candidate.isInHeader) return false;
      
      // Skip elements whose text equals username, display name, or includes "Instagram"
      const lowerText = text.toLowerCase();
      if (lowerText.includes('instagram') || 
          lowerText.includes('profile') ||
          lowerText.includes('follow') ||
          lowerText.includes('message') ||
          lowerText.includes('send')) return false;
      
      // Skip very short text (likely UI elements)
      if (text.length < 3) return false;
      
      return true;
    });

    const filteredCount = rawCandidates.length - filteredCandidates.length;
    console.log(`[conversationDetector] Raw candidates: ${rawCandidates.length}, filtered: ${filteredCount}`);

    // --- Step 4: Determine Conversation State ---
    const validMessageCount = filteredCandidates.length;
    
    await humanDelay(500, 1000, 'after conversation detection');
    
    if (validMessageCount >= 1) {
      console.log(`[conversationDetector] Detected conversation: true (${validMessageCount} valid messages)`);
      const sampleMessages = filteredCandidates.slice(0, 3).map(c => c.text);
      console.log(`[conversationDetector] Sample messages: ${sampleMessages.join(', ')}`);
      return { 
        hasConversation: true, 
        reason: 'detected_valid_message_bubbles',
        messageCount: validMessageCount
      };
    } else {
      console.log(`[conversationDetector] Detected empty thread (no valid messages)`);
      return { 
        hasConversation: false, 
        reason: 'empty_modal_thread',
        messageCount: 0
      };
    }

  } catch (err) {
    console.log(`[${ts()}] 💥 Conversation detection error: ${err.message}`);
    return { hasConversation: false, reason: 'detection_error' };
  }
}

module.exports = { detectExistingConversation };
