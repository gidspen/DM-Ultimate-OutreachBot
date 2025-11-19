// main_messageDrafter.js
// Main orchestrator for Instagram Draft Message Automation

require('dotenv').config();
const { chromium } = require('playwright');
const { validateEnv } = require('./envValidator');
const { loadDatabaseRows } = require('./sheetsManager');
const { loadFilteredDatabase } = require('./databaseLoader');
const { updateDraftData } = require('./sheetsManager');
const { openDMController } = require('./dmFlowController');
const { detectExistingConversation } = require('./conversationDetector');
const { draftMessage } = require('./messageDrafter');
const { humanDelay } = require('./utils');
const logger = require('./logger');

/**
 * Checks if dry-run mode is enabled via CLI flag
 * @returns {boolean} True if --dry-run flag is present
 */
function isDryRun() {
  return process.argv.includes('--dry-run');
}

/**
 * Initializes browser with persistent context
 * @returns {Promise<Object>} { browser } - Browser context (no page created)
 */
async function initializeBrowser() {
  logger.info('Launching browser with persistent context...');
  
  const browser = await chromium.launchPersistentContext('./browser-data', {
    headless: false,
    viewport: { width: 1200, height: 800 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  logger.success('Browser launched successfully');
  
  return { browser };
}

/**
 * Navigates to a user's Instagram profile page
 * @param {Object} page - Playwright page object
 * @param {string} username - Instagram username to navigate to
 */
async function navigateToProfile(page, username) {
  const profileUrl = `https://www.instagram.com/${username}/`;
  logger.info(`Navigating to profile: ${profileUrl}`);
  
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
  await humanDelay(1500, 2500);
  
  // Check if redirected to login page
  const loginInput = await page.$('input[name="username"]');
  if (loginInput) {
    throw new Error('Not logged in - redirected to login page. Run loginSeeder.js first.');
  }
  
  logger.success(`Successfully navigated to ${username}'s profile`);
}

/**
 * Processes a single user: opens DM, checks conversation, drafts message
 * @param {Object} page - Playwright page object
 * @param {Object} row - User row data from database
 * @param {string} draftMessageText - The message template to use
 * @returns {Promise<Object>} Result object with success status and details
 */
async function processUser(page, row, draftMessageText) {
  const { username, rowIndex } = row;
  const result = {
    username,
    rowIndex,
    success: false,
    skipped: false,
    error: null,
    message: null,
  };
  
  try {
    // Navigate to user's profile
    await navigateToProfile(page, username);
    
    // Open DM interface
    logger.info(`Opening DM for ${username}...`);
    const dmResult = await openDMController(page);
    
    if (!dmResult.success) {
      result.error = `Failed to open DM: ${dmResult.error || 'Unknown error'}`;
      logger.error(`Failed to open DM for ${username}: ${result.error}`);
      return result;
    }
    
    logger.success(`DM opened for ${username} (method: ${dmResult.used})`);
    
    // Wait a bit for DM to fully load
    await humanDelay(1000, 2000);
    
    // Check for existing conversation
    logger.info(`Checking for existing conversation with ${username}...`);
    const conversationResult = await detectExistingConversation(page);
    
    if (conversationResult.hasConversation) {
      result.skipped = true;
      result.error = `Existing conversation detected (${conversationResult.messageCount} messages)`;
      logger.warn(`Skipping ${username}: ${result.error}`);
      return result;
    }
    
    logger.info(`No existing conversation found for ${username}`);
    
    // Draft the message
    logger.info(`Drafting message for ${username}...`);
    const draftResult = await draftMessage(page, {});
    
    if (!draftResult.success) {
      result.error = `Failed to draft message: ${draftResult.error || 'Unknown error'}`;
      logger.error(`Failed to draft message for ${username}: ${result.error}`);
      return result;
    }
    
    result.success = true;
    result.message = draftResult.message;
    logger.success(`Message drafted successfully for ${username}`);
    
    return result;
    
  } catch (error) {
    result.error = error.message || String(error);
    logger.error(`Error processing ${username}: ${result.error}`);
    return result;
  }
}

/**
 * Main orchestrator function
 */
async function run() {
  let browser = null;
  let config = null;
  
  try {
    // Check for dry-run mode
    const dryRun = isDryRun();
    if (dryRun) {
      logger.section('DRY RUN MODE - No browser or sheet updates will occur');
    }
    
    // --- STEP 1: Validate Environment ---
    logger.section('Environment Validation');
    try {
      config = validateEnv();
      logger.success('Environment validation passed');
      logger.info(`Instagram username: ${config.instagramUsername}`);
      logger.info(`Sheet: ${config.sheetName} (ID: ${config.sheetId})`);
      logger.info(`Source mode: ${config.sourceMode}`);
      logger.info(`Activate status: ${config.activateStatus}`);
      logger.info(`Max draft: ${config.maxDraft}`);
      logger.info(`Max process: ${config.maxProcess}`);
    } catch (error) {
      logger.error(`Environment validation failed: ${error.message}`);
      throw error;
    }
    
    // --- STEP 2: Load All Rows ---
    logger.section('Loading Database Rows');
    let allRows;
    try {
      allRows = await loadDatabaseRows();
      logger.info(`Loaded ${allRows.length} total rows from Google Sheets`);
    } catch (error) {
      logger.error(`Failed to load database rows: ${error.message}`);
      throw error;
    }
    
    // --- STEP 3: Filter + Dedupe ---
    logger.section('Filtering and Deduplication');
    let filteredRows;
    try {
      filteredRows = await loadFilteredDatabase();
      logger.info(`After filtering: ${filteredRows.length} rows ready for processing`);
      
      if (filteredRows.length === 0) {
        logger.warn('No rows match the filter criteria. Exiting.');
        return;
      }
    } catch (error) {
      logger.error(`Failed to filter database: ${error.message}`);
      throw error;
    }
    
    // --- STEP 4: Initialize Browser (skip in dry-run) ---
    if (dryRun) {
      logger.section('Dry Run - Skipping Browser Initialization');
      logger.info('Would process the following users:');
      filteredRows.slice(0, config.maxDraft).forEach((row, index) => {
        logger.info(`  ${index + 1}. ${row.username} (row ${row.rowIndex})`);
      });
      logger.success('Dry run completed successfully');
      return;
    }
    
    logger.section('Browser Initialization');
    try {
      const browserResult = await initializeBrowser();
      browser = browserResult.browser;
      
      // Verify login with a temporary page (will be closed)
      const tempPage = await browser.newPage();
      await tempPage.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
      await humanDelay(2000, 3000);
      
      const loginInput = await tempPage.$('input[name="username"]');
      if (loginInput) {
        await tempPage.close();
        throw new Error('Not logged in. Please run loginSeeder.js first to establish session.');
      }
      
      // Close the temporary verification page
      await tempPage.close();
      logger.success('Browser initialized and session verified');
      
      // --- STEP 5: Iterate Through Users ---
      logger.section('Drafting Messages');
      
      let draftedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < filteredRows.length && draftedCount < config.maxDraft; i++) {
        const row = filteredRows[i];
        logger.info(`Processing user ${i + 1}/${filteredRows.length}: ${row.username}`);
        
        // Create a new tab for this user
        logger.info(`Creating new tab for ${row.username}...`);
        const userPage = await browser.newPage();
        logger.success(`New tab created for ${row.username} (tab ${i + 1})`);
        
        // Track whether drafting succeeded for this user
        let draftingSucceeded = false;
        
        // Small delay before starting work on the new tab
        await humanDelay(500, 1000);
        
        try {
          const result = await processUser(userPage, row, config.draftMessage);
          
          if (result.skipped) {
            // Update sheet with "Convo Exists" status
            try {
              const timestamp = new Date().toISOString();
              await updateDraftData(result.rowIndex, timestamp, '', 'Convo Exists');
              logger.success(`Updated sheet for ${result.username} (row ${result.rowIndex}) - Status: Convo Exists`);
            } catch (updateError) {
              logger.error(`Failed to update sheet for ${result.username}: ${updateError.message}`);
            }
            skippedCount++;
            // Drafting did not succeed - tab will be closed
            logger.info(`Drafting failed for ${row.username}: conversation exists`);
            draftingSucceeded = false;
          } else if (result.success) {
            // Update Google Sheet with drafted data
            try {
              const timestamp = new Date().toISOString();
              await updateDraftData(result.rowIndex, timestamp, result.message, 'Drafted');
              logger.success(`Updated sheet for ${result.username} (row ${result.rowIndex}) - Status: Drafted`);
              draftedCount++;
              // Drafting succeeded - tab will remain open
              draftingSucceeded = true;
              logger.success(`Drafting succeeded for ${row.username} - tab will remain open`);
              
            } catch (updateError) {
              logger.error(`Failed to update sheet for ${result.username}: ${updateError.message}`);
              errorCount++;
              // Sheet update failed, but drafting succeeded - keep tab open
              draftingSucceeded = true;
            }
          } else {
            // Update sheet with "Failed" status
            try {
              const timestamp = new Date().toISOString();
              const errorMessage = result.error || 'Unknown error';
              await updateDraftData(result.rowIndex, timestamp, errorMessage, 'Failed');
              logger.success(`Updated sheet for ${result.username} (row ${result.rowIndex}) - Status: Failed`);
            } catch (updateError) {
              logger.error(`Failed to update sheet for ${result.username}: ${updateError.message}`);
            }
            errorCount++;
            // Drafting did not succeed - tab will be closed
            logger.info(`Drafting failed for ${result.username}: ${result.error || 'Unknown error'}`);
            draftingSucceeded = false;
          }
          
        } catch (userError) {
          // Update sheet with "Failed" status for unexpected errors
          try {
            const timestamp = new Date().toISOString();
            const errorMessage = userError.message || 'Unexpected error';
            await updateDraftData(row.rowIndex, timestamp, errorMessage, 'Failed');
            logger.success(`Updated sheet for ${row.username} (row ${row.rowIndex}) - Status: Failed`);
          } catch (updateError) {
            logger.error(`Failed to update sheet for ${row.username}: ${updateError.message}`);
          }
          errorCount++;
          logger.error(`Unexpected error processing ${row.username}: ${userError.message}`);
          // Drafting did not succeed - tab will be closed
          draftingSucceeded = false;
        }
        
        // Conditionally close tab based on success
        if (draftingSucceeded) {
          logger.info(`Keeping tab open for ${row.username} - message successfully drafted`);
        } else {
          logger.info(`Closing tab for ${row.username} - drafting failed or skipped`);
          try {
            await userPage.close();
            logger.success(`Tab closed for ${row.username}`);
          } catch (closeError) {
            logger.error(`Error closing tab for ${row.username}: ${closeError.message}`);
          }
        }
        
        // Human-like delay before creating next tab
        await humanDelay(2000, 4000);
        
        // Check if we've reached the draft limit
        if (draftedCount >= config.maxDraft) {
          logger.warn(`Reached MAX_DRAFT limit (${config.maxDraft}). Stopping.`);
          logger.info(`All ${draftedCount} successfully drafted tabs remain open for manual sending.`);
          break;
        }
      }
      
      // --- STEP 6: Final Summary ---
      logger.section('Final Summary');
      logger.info(`Total users processed: ${filteredRows.length}`);
      logger.success(`Successfully drafted: ${draftedCount}`);
      logger.warn(`Skipped (existing conversation): ${skippedCount}`);
      logger.error(`Errors: ${errorCount}`);
      logger.info(`Browser contains ${draftedCount} open tabs with successfully drafted messages.`);
      logger.info(`Each open tab contains a drafted message ready for manual sending.`);
      logger.info(`Failed and skipped user tabs have been automatically closed.`);
      
    } catch (browserError) {
      logger.error(`Browser error: ${browserError.message}`);
      throw browserError;
    } finally {
      // --- STEP 7: Keep Browser Open for Inspection ---
      if (browser) {
        logger.section('Script Completed');
        logger.info('Browser will remain open for inspection.');
        logger.info('Close the browser manually when finished.');
        // Browser stays open - do not close it
      }
    }
    
  } catch (fatalError) {
    logger.error(`Fatal error: ${fatalError.message}`);
    if (browser) {
      logger.section('Fatal Error - Browser Remains Open');
      logger.info('Browser will remain open for inspection.');
      logger.info('Close the browser manually when finished.');
      // Browser stays open for inspection even on fatal errors
    }
    // Don't exit immediately - let user inspect before closing
    logger.warn('Press Ctrl+C to exit and close the browser.');
  }
}

// Run the orchestrator
run().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});

