// dmFlowController.js
const { openDirectMessage } = require('./flow1_directMessage');
const { openDMViaOptionsMenu } = require('./flow2_optionsMenu');
const { humanDelay, ts } = require('./utils');

/**
 * Unified DM opening controller
 * Attempts Flow 1 first, then falls back to Flow 2 automatically.
 *
 * @param {Object} profilePage - Playwright page object (user's profile)
 * @returns {Object} result - { success, used, flow1, flow2 }
 */
async function openDMController(profilePage) {
  console.log(`[${ts()}] 🚀 Starting DM Flow Controller...`);
  console.log(`[${ts()}] 🎯 Attempting Flow 1 (Direct Message)...`);

  // --- Try Flow 1 ---
  await humanDelay(500, 1000, 'before attempting Flow 1');
  let flow1Result = {};
  try {
    flow1Result = await openDirectMessage(profilePage);
  } catch (err) {
    console.log(`[${ts()}] 💥 Flow 1 crashed: ${err.message}`);
    flow1Result = { success: false, method: 'flow1', error: err.message };
  }

  // If Flow 1 succeeded, stop here
  if (flow1Result.success) {
    console.log(`[${ts()}] ✅ Flow 1 succeeded — DM opened successfully.`);
    return {
      success: true,
      used: 'flow1',
      flow1: flow1Result,
      flow2: null,
      timestamp: ts(),
    };
  }

  // --- Fallback to Flow 2 ---
  console.log(`[${ts()}] ⚠️ Flow 1 failed (${flow1Result.error || flow1Result.reason || 'Unknown error'})`);
  console.log(`[${ts()}] 🔁 Trying Flow 2 (Options Menu fallback)...`);
  await humanDelay(500, 1000, 'between Flow 1 and Flow 2');

  let flow2Result = {};
  try {
    flow2Result = await openDMViaOptionsMenu(profilePage);
  } catch (err) {
    console.log(`[${ts()}] 💥 Flow 2 crashed: ${err.message}`);
    flow2Result = { success: false, method: 'flow2', error: err.message };
  }

  if (flow2Result.success) {
    console.log(`[${ts()}] ✅ Flow 2 succeeded (Fallback path).`);
    return {
      success: true,
      used: 'flow2',
      flow1: flow1Result,
      flow2: flow2Result,
      timestamp: ts(),
    };
  }

  // --- Both failed ---
  console.log(`[${ts()}] ❌ Both Flow 1 and Flow 2 failed.`);
  return {
    success: false,
    used: 'none',
    flow1: flow1Result,
    flow2: flow2Result,
    timestamp: ts(),
  };
}

module.exports = { openDMController };
