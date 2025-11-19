// conversationTools.js
// Utilities for DM name extraction and conversation detection.

const MAX_OPERATION_MS = 10000;

function now() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${now()}] [conversationTools] ${message}`);
}

function sanitizeFirstName(raw) {
  if (!raw) return '';

  const stripped = String(raw)
    .replace(/[\u{1F100}-\u{1FAD0}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[|•–—\-()_.@0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return '';

  const firstToken = stripped.split(' ')[0] || '';
  if (!firstToken) return '';

  const cleaned = firstToken.replace(/[^a-zA-ZÀ-ÿ'’-]/g, '');
  if (!cleaned) return '';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function getTextFromSelectors(page, selectors, options = {}) {
  for (const selector of selectors) {
    try {
      const locator = options.scope
        ? page.locator(options.scope).locator(selector).first()
        : page.locator(selector).first();

      if (await locator.count()) {
        const text = options.attribute
          ? await locator.getAttribute(options.attribute)
          : await locator.textContent();

        if (text && text.trim()) {
          log(`🔎 Name candidate from selector "${selector}"`);
          return text.trim();
        }
      }
    } catch (err) {
      log(`⚠️ Selector "${selector}" lookup failed: ${err.message}`);
    }
  }
  return '';
}

async function getFirstName(page) {
  const start = Date.now();
  try {
    await page.waitForSelector('div[role="dialog"], [role="main"], [role="presentation"]', {
      timeout: 5000,
    }).catch(() => {});

    const isPopup = await page.$('div[role="dialog"]');
    const scope = isPopup ? 'div[role="dialog"]' : undefined;

    const selectors = isPopup
      ? [
          'h2 span[title]',
          'h2 span',
          'header h2 span',
          '[data-visualcompletion="ignore-dynamic"] span',
        ]
      : [
          'header h2 span[title]',
          'header h2 span',
          'h2 span[title]',
          'h2 span',
          '[data-testid="chat-header"] h2 span',
        ];

    let displayName = await getTextFromSelectors(page, selectors, { scope });

    if (!displayName) {
      const ariaSelectors = isPopup
        ? ['[role="dialog"] a[aria-label]', '[role="dialog"] [aria-label]']
        : ['a[aria-label^="Open the profile page of"]', 'header [aria-label]'];

      displayName = await getTextFromSelectors(page, ariaSelectors, {
        scope,
        attribute: 'aria-label',
      });

      if (displayName) {
        log('🔎 Name extracted via aria-label');
      }
    }

    if (!displayName) {
      const fallbackSelectors = isPopup
        ? ['div[role="dialog"] span[dir="auto"]', 'div[role="dialog"] span']
        : ['header span[dir="auto"]', 'span[dir="auto"]'];

      displayName = await page.$$eval(fallbackSelectors.join(', '), nodes => {
        const candidates = nodes
          .map(node => (node.innerText || node.textContent || '').trim())
          .filter(Boolean)
          .filter(txt => txt.length <= 40);

        return candidates[0] || '';
      }).catch(() => '');

      if (displayName) {
        log('🔎 Name extracted via generic fallback');
      }
    }

    const firstName = sanitizeFirstName(displayName);
    if (firstName) {
      log(`✅ getFirstName resolved: ${firstName}`);
    } else {
      log('ℹ️ getFirstName: no valid first name found');
    }

    return firstName;
  } catch (err) {
    log(`💥 getFirstName error: ${err.message}`);
    return '';
  } finally {
    const elapsed = Date.now() - start;
    if (elapsed > MAX_OPERATION_MS) {
      log(`⚠️ getFirstName exceeded recommended duration (${elapsed}ms)`);
    }
  }
}

async function hasExistingMessages(page) {
  const start = Date.now();
  try {
    const containerSelector =
      'div[data-scope="messages_table"], div[style*="--chat-composer-background-color"]';

    await page.waitForSelector(containerSelector, { timeout: 10000 });

    const messageExists = await page
      .locator('div[role="presentation"] div[dir="auto"]')
      .evaluateAll(nodes =>
        nodes.some(node => {
          const text = (node.innerText || node.textContent || '').trim();
          if (!text) return false;
          if (text.toLowerCase().includes('loading')) return false;
          return true;
        })
      );

    if (messageExists) {
      log('✅ Conversation detected via updated DOM scan');
    } else {
      log('💬 No existing messages detected in updated DOM');
    }

    return Boolean(messageExists);
  } catch (err) {
    log(`💥 hasExistingMessages error: ${err.message}`);
    return false;
  } finally {
    const elapsed = Date.now() - start;
    if (elapsed > MAX_OPERATION_MS) {
      log(`⚠️ hasExistingMessages exceeded recommended duration (${elapsed}ms)`);
    }
  }
}

module.exports = {
  getFirstName,
  hasExistingMessages,
};

