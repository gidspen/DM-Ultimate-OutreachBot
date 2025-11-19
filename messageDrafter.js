// messageDrafter.js
require('dotenv').config();
const { extractFirstName } = require('./nameExtractor');
const { humanDelay, ts } = require('./utils');

/**
 * Drafts a personalized message in an Instagram DM without sending it.
 * @param {object} dmPage - Playwright Page object (DM thread already open)
 * @param {object} options
 * @param {string} [options.firstName] - Pre-extracted first name, if available.
 * @param {boolean} [options.nameFound] - Whether the provided first name is validated.
 * @returns {Promise<{ success: boolean, firstName?: string, message?: string, typedText?: string }>}
 */
async function draftMessage(dmPage, options = {}) {
  console.log(`[${ts()}] 🧩 Starting message drafting process...`);

  try {
    // --- STEP 1: Extract first name from profile ---
    let firstName = options.firstName || '';
    let nameFound = typeof options.nameFound === 'boolean' ? options.nameFound : false;

    if (!firstName) {
      const nameResult = await extractFirstName(dmPage);
      firstName = nameResult.firstName;
      nameFound = nameResult.success;
    } else {
      nameFound = options.nameFound ?? (firstName.trim().length > 0);
      console.log(`[${ts()}] 🧠 Using pre-extracted name: ${firstName || '(none)'}`);
    }

    console.log(`[${ts()}] 🧠 Extracted name: ${firstName || '(none)'} | Success: ${nameFound}`);

    // --- STEP 2: Build the personalized message from .env ---
    const baseMessage =
      process.env.DRAFT_MESSAGE ||
      "What's up! Great seeing you here. Are you here for the free content or are you interested in buying hotels?";

    let message;
    if (nameFound && firstName.trim()) {
      const idx = baseMessage.indexOf('!');
      message =
        idx === -1
          ? `What's up ${firstName.trim()}! ${baseMessage}`
          : baseMessage.slice(0, idx) + ` ${firstName.trim()}` + baseMessage.slice(idx);
    } else {
      message = baseMessage;
    }

    console.log(`[${ts()}] ✍️ Constructed message: "${message}"`);

    // --- STEP 3: Locate Instagram DM input field ---
    const selectors = [
      'p[contenteditable="true"]',
      'div[contenteditable="true"]',
      'p[dir="auto"][contenteditable]',
      'textarea',
      'div[role="textbox"]',
    ];

    let input = null;
    for (const sel of selectors) {
      input = await dmPage.$(sel);
      if (input) {
        console.log(`[${ts()}] ✅ Found input field: ${sel}`);
        break;
      }
    }

    if (!input) {
      console.log(`[${ts()}] ❌ No DM input field found`);
      return { success: false, firstName, message };
    }

    // --- STEP 4: Focus & clear existing text ---
    await humanDelay(250, 500, 'before focusing DM input');
    await input.click({ delay: 100 });
    await humanDelay(250, 500, 'after focusing DM input');
    await dmPage.keyboard.down('Control');
    await dmPage.keyboard.press('A');
    await dmPage.keyboard.up('Control');
    await dmPage.keyboard.press('Backspace');
    console.log(`[${ts()}] 🧹 Cleared existing text`);

    // --- STEP 5: Type message (simulate human typing) ---
    const firstTen = message.slice(0, 10);
    const remainder = message.slice(10);

    for (const ch of firstTen.split('')) {
      await humanDelay(40, 100, 'between keystrokes');
      await dmPage.keyboard.type(ch);
    }
    if (remainder.length > 0) {
      await humanDelay(250, 500, 'before bulk insert');
      await dmPage.keyboard.insertText(remainder);
    }

    // Dispatch input/change so IG recognizes text
    await dmPage.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, input);

    // --- STEP 6: Verify message appears ---
    await humanDelay(500, 1000, 'after text entry');
    const typedText = await dmPage.evaluate(el => el.innerText || el.textContent, input);

    if (typedText && typedText.trim() === message.trim()) {
      console.log(`[${ts()}] ✅ Message populated successfully`);
      return { success: true, firstName, message, typedText };
    } else {
      console.log(`[${ts()}] ❌ Verification failed`);
      console.log(`[${ts()}] Expected: ${message}`);
      console.log(`[${ts()}] Got: ${typedText}`);
      return { success: false, firstName, message, typedText };
    }
  } catch (err) {
    console.log(`[${ts()}] 💥 Drafting error: ${err.message}`);
    return { success: false };
  }
}

module.exports = { draftMessage };
