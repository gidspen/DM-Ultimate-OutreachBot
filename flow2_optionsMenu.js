// flow2_optionsMenu.js
const wait = (min,max)=>new Promise(r=>setTimeout(r,Math.random()*(max-min)+min));
const ts=()=>new Date().toISOString();

async function openDMViaOptionsMenu(profilePage){
  console.log(`[${ts()}] 🧩 Starting Flow #2 (Options Menu)...`);
  try{
    // Scroll to top & locate ⋯
    await profilePage.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));
    const optionsSelector='svg[aria-label="Options"]';
    const svg=await profilePage.waitForSelector(optionsSelector,{timeout:7000}).catch(()=>null);
    if(!svg)return{success:false,method:'flow2',reason:'options_icon_not_found'};
    const parentHandle=await svg.evaluateHandle(el=>el.closest('div[role="button"],button'));
    const parent=parentHandle&&parentHandle.asElement?parentHandle.asElement():null;
    if(!parent){
      console.log(`[${ts()}] ❌ No clickable parent for Options button`);
      return{success:false,method:'flow2',reason:'no_clickable_parent'};
    }
    console.log(`[${ts()}] ✅ Found Options (⋯) button`);

    await wait(400,800);
    let clicked=false;
    try{
      await profilePage.click(optionsSelector);
      clicked=true;
    }catch(err){
      try{
        if(parent){
          await parent.click();
          clicked=true;
        }
      }catch{
        if(parent){
          await parent.click({force:true});
          clicked=true;
        }
      }
    }
    if(!clicked&&parent){
      try{
        await parent.click({force:true});
        clicked=true;
      }catch{}
    }
    if(!clicked)return{success:false,method:'flow2',reason:'options_click_failed'};
    console.log(`[${ts()}] 🖱️ Clicked Options button`);
    await wait(1800,2500); // animation buffer

    // Wait for real Instagram dialog portal (without requiring aria-modal)
    const dialog=await profilePage.waitForSelector(
      'div[role="dialog"]',
      {timeout:7000}
    ).catch(()=>null);
    if(!dialog){
      console.log(`[${ts()}] ❌ No dialog detected after clicking ⋯`);
      return{success:false,method:'flow2',reason:'dialog_not_found'};
    }
    console.log(`[${ts()}] ✅ Options dialog detected`);

    // Find visible Send message button inside the dialog
    const sendSelector='button:has-text("Send message")';
    const sendBtn=await profilePage.waitForSelector(sendSelector,{timeout:3000}).catch(()=>null);

    if(!sendBtn){
      console.log(`[${ts()}] ❌ 'Send message' button not found in dialog`);
      return{success:false,method:'flow2',reason:'send_btn_not_found'};
    }
    console.log(`[${ts()}] ✅ Found 'Send message' button`);

    // Physical mouse click
    const box=await sendBtn.boundingBox();
    if(!box){
      console.log(`[${ts()}] ❌ No bounding box for button`);
      return{success:false,method:'flow2',reason:'no_bbox'};
    }
    const x=box.x+box.width/2, y=box.y+box.height/2;
    await profilePage.mouse.move(x,y,{steps:3});
    await wait(100,250);
    await profilePage.mouse.down();
    await wait(50,150);
    await profilePage.mouse.up();
    console.log(`[${ts()}] 🖱️ Clicked 'Send message' at (${x.toFixed(1)},${y.toFixed(1)})`);
    await wait(2000,3000);

    // Verify DM interface opened - enhanced detection
    console.log(`[${ts()}] 🔍 Verifying DM interface opened...`);
    await wait(1500, 2500); // Give Instagram more time to load
    
    let dmOpened = false;
    let detectionMethod = null;
    
    // Strategy 1: Check URL
    const currentUrl = profilePage.url();
    console.log(`[${ts()}] 🔍 Current URL: ${currentUrl}`);
    if (currentUrl.includes('/direct/')) {
      dmOpened = true;
      detectionMethod = 'URL check';
      console.log(`[${ts()}] ✅ DM detected via URL`);
    }
    
    // Strategy 2: Check for input fields with multiple selectors
    if (!dmOpened) {
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
          const input = await profilePage.waitForSelector(selector, { timeout: 4000 });
          if (input) {
            dmOpened = true;
            detectionMethod = `input field (${selector})`;
            console.log(`[${ts()}] ✅ DM detected via ${selector}`);
            break;
          }
        } catch (err) {
          // Continue to next selector
        }
      }
    }
    
    // Strategy 3: Check for dialog
    if (!dmOpened) {
      try {
        const dialog = await profilePage.waitForSelector('[role="dialog"]', { timeout: 4000 });
        if (dialog) {
          // Verify it has an input inside
          const inputInDialog = await dialog.$('textarea, [contenteditable="true"]');
          if (inputInDialog) {
            dmOpened = true;
            detectionMethod = 'dialog with input';
            console.log(`[${ts()}] ✅ DM detected via dialog`);
          }
        }
      } catch (err) {
        // Dialog not found
      }
    }
    
    // Strategy 4: Delayed URL check
    if (!dmOpened) {
      await wait(2000, 3000);
      const newUrl = profilePage.url();
      console.log(`[${ts()}] 🔍 URL after wait: ${newUrl}`);
      if (newUrl.includes('/direct/')) {
        dmOpened = true;
        detectionMethod = 'URL check (delayed)';
        console.log(`[${ts()}] ✅ DM detected via delayed URL check`);
      }
    }

    if(dmOpened){
      console.log(`[${ts()}] ✅ DM interface opened via Flow #2 (method: ${detectionMethod})`);

      // --- STEP: Handle potential notification popup ---
      try {
        console.log(`[${ts()}] 🔍 Checking for possible notification popup...`);

        // Wait briefly for any overlay or popup to appear
        await wait(800, 1500);

        // Perform a random "safe click" in the chat area to dismiss overlays
        const randomX = Math.floor(Math.random() * 200) + 600;  // between 600–800 px horizontally
        const randomY = Math.floor(Math.random() * 150) + 300;  // between 300–450 px vertically
        await profilePage.mouse.move(randomX, randomY, { steps: 2 });
        await wait(100, 200);
        await profilePage.mouse.down();
        await wait(50, 120);
        await profilePage.mouse.up();
        console.log(`[${ts()}] 🖱️ Random click performed at (${randomX}, ${randomY}) to close popups`);

        // Wait briefly to allow any modal to close
        await wait(1000, 1500);
      } catch (popupErr) {
        console.log(`[${ts()}] ⚠️ Popup handling skipped: ${popupErr.message}`);
      }

      // Return success after popup check
      return{success:true,method:'flow2'};
    }else{
      // Debug: Log what we can see
      try {
        const pageTitle = await profilePage.title();
        const finalUrl = profilePage.url();
        const hasDialog = await profilePage.$('[role="dialog"]');
        const hasInput = await profilePage.$('textarea, [contenteditable="true"]');
        
        console.log(`[${ts()}] 🔍 Debug info:`);
        console.log(`[${ts()}]   - Page title: ${pageTitle}`);
        console.log(`[${ts()}]   - Final URL: ${finalUrl}`);
        console.log(`[${ts()}]   - Has dialog: ${hasDialog ? 'yes' : 'no'}`);
        console.log(`[${ts()}]   - Has input: ${hasInput ? 'yes' : 'no'}`);
      } catch (debugErr) {
        console.log(`[${ts()}] ⚠️ Debug info collection failed: ${debugErr.message}`);
      }
      
      console.log(`[${ts()}] ❌ DM interface not detected`);
      return{success:false,method:'flow2',reason:'dm_not_opened'};
    }
  }catch(err){
    console.log(`[${ts()}] 💥 Flow #2 Error: ${err.message}`);
    return{success:false,method:'flow2',error:err.message};
  }
}
module.exports={openDMViaOptionsMenu};
