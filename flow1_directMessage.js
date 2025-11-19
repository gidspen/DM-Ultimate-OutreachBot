/**
 * Flow 1: Direct Message Opening
 * 
 * Locates the "Message" button on a follower's profile page, clicks it with
 * human-like behavior, and detects when the DM modal opens successfully.
 */

/**
 * Helper function for random delays
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {Promise} - Promise that resolves after random delay
 */
const wait = (min, max) => new Promise(res => setTimeout(res, Math.random() * (max - min) + min));

/**
 * Helper function for timestamps
 * @returns {string} - Current timestamp in ISO format
 */
const timestamp = () => new Date().toISOString();

/**
 * Opens direct message interface by clicking the "Message" button
 * 
 * @param {Object} profilePage - Playwright page object for the follower's loaded profile
 * @returns {Object} { success, method, timestamp } - Result of the operation
 */
async function openDirectMessage(profilePage) {
  const startTime = timestamp();
  
  try {
    console.log(`[${startTime}] 🧩 flow1_directMessage.js starting...`);
    
    // Step 1: Locate "Message" Button
    console.log(`[${timestamp()}] 🔍 Waiting for username header...`);
    const usernameHeaderSelector = 'span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
    await profilePage.waitForSelector(usernameHeaderSelector, { timeout: 7000 }).catch(() => null);

    console.log(`[${timestamp()}] 🔍 Looking for 'Message' button...`);
    
    let messageButton = null;
    
    // Try preferred selectors for Message button
    try {
      const messageSelector = 'div[role="button"]:has-text("Message")';
      await profilePage.waitForSelector(messageSelector, { timeout: 5000 });
      messageButton = await profilePage.$(messageSelector);
      if (messageButton) {
        console.log(`[${timestamp()}] ✅ Found 'Message' button with div[role="button"] selector`);
      }
    } catch (error) {
      // Continue to next selector
    }
    
    // Fallback selector
    if (!messageButton) {
      try {
        messageButton = await profilePage.$('button:has-text("Message")');
        if (messageButton) {
          console.log(`[${timestamp()}] ✅ Found 'Message' button with button selector`);
        }
      } catch (error) {
        // Continue to error handling
      }
    }
    
    // Additional fallback selectors
    if (!messageButton) {
      const fallbackSelectors = [
        'a:has-text("Message")',
        '[data-testid*="message"]',
        'span:has-text("Message")',
        '*:has-text("Message")'
      ];
      
      for (const selector of fallbackSelectors) {
        try {
          messageButton = await profilePage.$(selector);
          if (messageButton) {
            console.log(`[${timestamp()}] ✅ Found 'Message' button with fallback selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
    }
    
    if (!messageButton) {
      console.log(`[${timestamp()}] ❌ No direct 'Message' button found on profile`);
      return { 
        success: false, 
        method: 'flow1', 
        timestamp: startTime,
        error: 'Message button not found'
      };
    }
    
    // Step 2: Click the Button (Human-Like)
    console.log(`[${timestamp()}] ⏳ Preparing to click 'Message' button...`);
    
    // Wait a short randomized delay (400-900 ms)
    const clickDelay = 400 + Math.random() * 500;
    console.log(`[${timestamp()}] ⏳ Waiting ${Math.round(clickDelay)}ms before clicking...`);
    await wait(400, 900);
    
    // Try normal click first
    try {
      await messageButton.click();
      console.log(`[${timestamp()}] 🖱️ Clicked 'Message' button normally`);
    } catch (error) {
      console.log(`[${timestamp()}] ⚠️ Normal click failed — trying force click`);
      try {
        await messageButton.click({ force: true });
        console.log(`[${timestamp()}] 🖱️ Clicked 'Message' button with force`);
      } catch (forceError) {
        console.log(`[${timestamp()}] ❌ Force click also failed: ${forceError.message}`);
        return { 
          success: false, 
          method: 'flow1', 
          timestamp: startTime,
          error: 'Failed to click Message button'
        };
      }
    }
    
    // Wait again (500-1000 ms) to mimic reaction time
    const reactionDelay = 500 + Math.random() * 500;
    console.log(`[${timestamp()}] ⏳ Waiting ${Math.round(reactionDelay)}ms for reaction...`);
    await wait(500, 1000);
    
    // Step 3: Detect DM Modal Opening
    console.log(`[${timestamp()}] 🔍 Detecting DM modal opening...`);
    
    // Wait a bit longer for Instagram to load
    await wait(1000, 1500);
    
    // Check current URL first
    const currentUrl = profilePage.url();
    console.log(`[${timestamp()}] 🔍 Current URL: ${currentUrl}`);
    
    // Try multiple detection strategies with longer timeouts
    let detectionMethod = null;
    let detected = false;
    
    // Strategy 1: Check URL change to /direct/
    if (currentUrl.includes('/direct/')) {
      detected = true;
      detectionMethod = 'URL check';
      console.log(`[${timestamp()}] ✅ DM detected via URL change`);
    }
    
    // Strategy 2: Wait for dialog modal
    if (!detected) {
      try {
        const dialog = await profilePage.waitForSelector('[role="dialog"]', { timeout: 8000 });
        if (dialog) {
          detected = true;
          detectionMethod = 'dialog modal';
          console.log(`[${timestamp()}] ✅ DM detected via dialog modal`);
        }
      } catch (err) {
        console.log(`[${timestamp()}] ⚠️ Dialog selector not found: ${err.message}`);
      }
    }
    
    // Strategy 3: Wait for input field (multiple selectors)
    if (!detected) {
      const inputSelectors = [
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="message"]',
        'p[contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea',
        '[contenteditable="true"]'
      ];
      
      for (const selector of inputSelectors) {
        try {
          const input = await profilePage.waitForSelector(selector, { timeout: 3000 });
          if (input) {
            detected = true;
            detectionMethod = `input field (${selector})`;
            console.log(`[${timestamp()}] ✅ DM detected via ${selector}`);
            break;
          }
        } catch (err) {
          // Continue to next selector
        }
      }
    }
    
    // Strategy 4: Check URL again after waiting
    if (!detected) {
      await wait(2000, 3000);
      const newUrl = profilePage.url();
      console.log(`[${timestamp()}] 🔍 URL after wait: ${newUrl}`);
      if (newUrl.includes('/direct/')) {
        detected = true;
        detectionMethod = 'URL check (delayed)';
        console.log(`[${timestamp()}] ✅ DM detected via delayed URL check`);
      }
    }
    
    // Strategy 5: Check for DM-specific elements
    if (!detected) {
      try {
        const dmElements = await profilePage.$$eval('*', elements => {
          return elements.some(el => {
            const text = el.innerText || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            return text.includes('Message') || 
                   text.includes('Send') || 
                   ariaLabel.includes('message') ||
                   ariaLabel.includes('Message');
          });
        });
        
        if (dmElements) {
          // Double check with a visible input
          const visibleInput = await profilePage.$('textarea, [contenteditable="true"]');
          if (visibleInput) {
            detected = true;
            detectionMethod = 'DM elements + input';
            console.log(`[${timestamp()}] ✅ DM detected via DM elements`);
          }
        }
      } catch (err) {
        console.log(`[${timestamp()}] ⚠️ DM elements check failed: ${err.message}`);
      }
    }
    
    if (detected) {
      console.log(`[${timestamp()}] ✅ DM interface detected (method: ${detectionMethod})`);
      console.log(`[${timestamp()}] ✅ flow1_directMessage completed successfully`);
      
      return { 
        success: true, 
        method: 'flow1', 
        timestamp: startTime 
      };
    } else {
      // Debug: Log what we can see on the page
      try {
        const pageTitle = await profilePage.title();
        const finalUrl = profilePage.url();
        const hasDialog = await profilePage.$('[role="dialog"]');
        const hasInput = await profilePage.$('textarea, [contenteditable="true"]');
        
        console.log(`[${timestamp()}] 🔍 Debug info:`);
        console.log(`[${timestamp()}]   - Page title: ${pageTitle}`);
        console.log(`[${timestamp()}]   - Final URL: ${finalUrl}`);
        console.log(`[${timestamp()}]   - Has dialog: ${hasDialog ? 'yes' : 'no'}`);
        console.log(`[${timestamp()}]   - Has input: ${hasInput ? 'yes' : 'no'}`);
      } catch (debugErr) {
        console.log(`[${timestamp()}] ⚠️ Debug info collection failed: ${debugErr.message}`);
      }
      
      console.log(`[${timestamp()}] ❌ DM modal not detected after click`);
      return { 
        success: false, 
        method: 'flow1', 
        timestamp: startTime,
        error: 'DM modal not detected'
      };
    }
    
  } catch (error) {
    console.error(`[${timestamp()}] ❌ Error in flow1_directMessage:`, error.message);
    console.error(`[${timestamp()}] Stack trace:`, error.stack);
    
    return { 
      success: false, 
      method: 'flow1', 
      timestamp: startTime,
      error: error.message
    };
  }
}

module.exports = { openDirectMessage };
