const { chromium } = require('playwright');
const readline = require('readline');

/**
 * Instagram Login Seeder
 * 
 * Launches a persistent Playwright browser to allow manual Instagram login.
 * Saves the session data in ./browser-data for use by other scripts.
 * 
 * Usage: node loginSeeder.js
 */

async function seedInstagramLogin() {
  let browser = null;
  
  try {
    console.log('🌱 Instagram Login Seeder');
    console.log('=' .repeat(40));
    
    // Step 1: Launch browser with persistent context
    console.log(`[${new Date().toISOString()}] 🚀 Launching browser with persistent context...`);
    
    browser = await chromium.launchPersistentContext('./browser-data', {
      headless: false,
      viewport: { width: 1200, height: 800 },
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    console.log(`[${new Date().toISOString()}] ✅ Browser launched successfully`);

    // Step 2: Navigate to Instagram
    console.log(`[${new Date().toISOString()}] 🌐 Navigating to Instagram...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    
    console.log(`[${new Date().toISOString()}] ✅ Instagram loaded`);

    // Step 3: Display instructions to user
    console.log('\n' + '=' .repeat(50));
    console.log('👉 Please log into Instagram manually in the opened window.');
    console.log('   Complete your login process, then return here.');
    console.log('=' .repeat(50));

    // Step 4: Wait for user confirmation
    console.log('\n⏳ Waiting for you to complete login...');
    console.log('   Press ENTER when you have successfully logged in.');
    
    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Wait for Enter key press
    await new Promise((resolve) => {
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });

    // Step 5: Confirm login saved
    console.log(`[${new Date().toISOString()}] ✅ Login saved. Session data stored in ./browser-data`);
    
    // Step 6: Close browser gracefully
    console.log(`[${new Date().toISOString()}] 🧹 Closing browser...`);
    await browser.close();
    
    console.log(`[${new Date().toISOString()}] 🎉 Login seeder completed successfully!`);
    console.log('💡 You can now run other scripts that will automatically use your saved session.');

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error:`, error.message);
    
    if (browser) {
      console.log(`[${new Date().toISOString()}] 🧹 Closing browser due to error...`);
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Failed to close browser:', closeError.message);
      }
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT. Exiting gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM. Exiting gracefully...');
  process.exit(0);
});

// Run the login seeder
seedInstagramLogin();
