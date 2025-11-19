// utils.js
const ts = () => new Date().toISOString();

/**
 * Adds a randomized delay between actions to mimic human behavior.
 */
async function humanDelay(min = 250, max = 1000, label = '') {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`[${ts()}] ⏳ Waiting ${delay}ms ${label ? `before ${label}` : ''}`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function performScroll(page, containerSelector, distance) {
  distance = distance || Math.floor(Math.random() * (2000 - 1200 + 1)) + 1200;

  console.log(`[${ts()}] 🖱️ Attempting to scroll ${distance}px inside followers modal`);

  // Move mouse near the middle of the screen
  const viewport = page.viewportSize();
  if (viewport) {
    await page.mouse.move(viewport.width / 2, viewport.height / 2, { steps: 8 });
  }

  // Try multiple scroll strategies for Instagram's modal
  const success = await page.evaluate(async (dist) => {
    // Strategy 1: Try to find the actual scrollable container
    let container = Array.from(document.querySelectorAll('div[role="dialog"] div')).find(div => {
      const style = getComputedStyle(div);
      return (style.overflowY === 'auto' || style.overflow === 'auto') && 
             div.scrollHeight > div.clientHeight;
    });

    // Strategy 2: Try the dialog itself
    if (!container) {
      container = document.querySelector('div[role="dialog"]');
    }

    // Strategy 3: Try any scrollable element in the modal
    if (!container) {
      container = Array.from(document.querySelectorAll('div[role="dialog"] *')).find(el => {
        const style = getComputedStyle(el);
        return el.scrollHeight > el.clientHeight && 
               (style.overflowY === 'auto' || style.overflow === 'auto' || style.overflowY === 'scroll');
      });
    }

    if (!container) {
      console.warn('⚠️ No scrollable container found - trying page scroll');
      // Fallback: scroll the page itself
      window.scrollBy(0, dist);
      return true;
    }

    console.log('✅ Found scrollable container:', container.className || container.tagName);

    const start = container.scrollTop;
    const target = start + dist;
    const steps = 40;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const eased = 1 - Math.pow(1 - progress, 2); // ease-out
      container.scrollTop = start + (target - start) * eased;
      await new Promise(r => setTimeout(r, 10 + Math.random() * 10));
    }

    return container.scrollTop > start;
  }, distance);

  if (!success) {
    console.log(`[${ts()}] ❌ Scroll failed — trying alternative method`);
    // Alternative: use page.mouse.wheel for scrolling
    await page.mouse.wheel(0, distance);
  } else {
    console.log(`[${ts()}] ✅ Scroll executed successfully`);
  }

  await humanDelay(800, 1800, 'after scroll');
}

/**
 * Waits for new follower elements to appear after a scroll.
 * @param {object} page - Playwright page
 * @param {string} followerSelector - CSS selector for follower usernames
 * @param {number} prevCount - count of previously loaded followers
 * @param {number} timeout - maximum wait time in ms
 */
async function waitForNewFollowers(page, followerSelector, prevCount, timeout = 5000) {
  const start = Date.now();
  let newCount = prevCount;

  while (Date.now() - start < timeout) {
    const currentCount = await page.$$eval(followerSelector, els => els.length);
    if (currentCount > prevCount) {
      console.log(`[${ts()}] ✅ New followers loaded (${currentCount - prevCount} added)`);
      return true;
    }
    await humanDelay(300, 600, 'waiting for new followers');
  }

  console.log(`[${ts()}] ⚠️ No new followers detected after ${timeout}ms`);
  return false;
}

module.exports = { ts, humanDelay, performScroll, waitForNewFollowers };