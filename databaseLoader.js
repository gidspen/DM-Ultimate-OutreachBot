// databaseLoader.js
require('dotenv').config();
const { loadDatabaseRows } = require('./sheetsManager');

/**
 * Valid source mode values
 */
const VALID_SOURCE_MODES = ['likes', 'comments', 'followers', 'all'];

/**
 * Validates and normalizes the SOURCE_MODE environment variable.
 * 
 * @returns {string} Normalized source mode (lowercase)
 * @throws {Error} If SOURCE_MODE is missing or invalid
 */
function validateSourceMode() {
  const sourceMode = process.env.SOURCE_MODE;

  if (!sourceMode || typeof sourceMode !== 'string') {
    throw new Error(
      'Missing required environment variable: SOURCE_MODE. ' +
      `Valid values are: ${VALID_SOURCE_MODES.join(', ')}`
    );
  }

  const normalized = sourceMode.trim().toLowerCase();

  if (!VALID_SOURCE_MODES.includes(normalized)) {
    throw new Error(
      `Invalid SOURCE_MODE value: "${sourceMode}". ` +
      `Valid values are: ${VALID_SOURCE_MODES.join(', ')}`
    );
  }

  return normalized;
}

/**
 * Validates and parses the MAX_PROCCESS environment variable.
 * Note: Variable name uses "PROCCESS" spelling as specified.
 * 
 * @returns {number} Maximum number of entries to process
 * @throws {Error} If MAX_PROCCESS is missing or invalid
 */
function validateMaxProcess() {
  const maxProcess = process.env.MAX_PROCCESS;

  if (!maxProcess) {
    throw new Error(
      'Missing required environment variable: MAX_PROCCESS. ' +
      'Must be a positive integer.'
    );
  }

  const parsed = parseInt(maxProcess, 10);

  if (isNaN(parsed) || parsed < 1) {
    throw new Error(
      `Invalid MAX_PROCCESS value: "${maxProcess}". ` +
      'Must be a positive integer.'
    );
  }

  return parsed;
}

/**
 * Validates the ACTIVATE_STATUS environment variable.
 * 
 * @returns {string} Status value to filter by
 * @throws {Error} If ACTIVATE_STATUS is missing
 */
function validateActivateStatus() {
  const activateStatus = process.env.ACTIVATE_STATUS;

  if (!activateStatus || typeof activateStatus !== 'string') {
    throw new Error(
      'Missing required environment variable: ACTIVATE_STATUS. ' +
      'Must be a non-empty string that matches row.status exactly.'
    );
  }

  return activateStatus.trim();
}

/**
 * Loads and filters database rows from Google Sheets.
 * 
 * Processing pipeline:
 * 1. Load all rows from sheetsManager
 * 2. Filter by status (exact match with ACTIVATE_STATUS)
 * 3. Filter by source mode (if not "all")
 * 4. Deduplicate by username (keep first occurrence)
 * 5. Limit to MAX_PROCCESS entries
 * 
 * @returns {Promise<Array<Object>>} Filtered and deduplicated array of row objects:
 *   - rowIndex: 1-based sheet row index
 *   - username: normalized lowercase username
 *   - source: source value from sheet
 *   - status: status value from sheet
 *   - rawRow: complete raw row array
 * @throws {Error} If environment variables are invalid or data loading fails
 */
async function loadFilteredDatabase() {
  // Validate environment variables upfront
  const activateStatus = validateActivateStatus();
  const sourceMode = validateSourceMode();
  const maxProcess = validateMaxProcess();

  // --- STAGE 1: Load all rows from Google Sheets ---
  let allRows;
  try {
    allRows = await loadDatabaseRows();
  } catch (error) {
    throw new Error(
      `Failed to load database rows: ${error.message}`
    );
  }

  if (!Array.isArray(allRows)) {
    throw new Error(
      'loadDatabaseRows() did not return an array. ' +
      'Received: ' + typeof allRows
    );
  }

  // --- STAGE 2: Filter by Status (exact match) ---
  // Only include rows where row.status exactly matches ACTIVATE_STATUS
  const statusFiltered = allRows.filter(row => {
    if (!row || typeof row !== 'object') {
      return false;
    }

    const rowStatus = row.status;
    
    // Handle missing or non-string status
    if (typeof rowStatus !== 'string') {
      return false;
    }

    // Exact match (case-sensitive as specified)
    return rowStatus.trim() === activateStatus;
  });

  // --- STAGE 3: Filter by Source Mode ---
  // If SOURCE_MODE is "all", skip this filter
  // Otherwise, only include rows where row.source exactly matches SOURCE_MODE
  let sourceFiltered;
  
  if (sourceMode === 'all') {
    sourceFiltered = statusFiltered;
  } else {
    sourceFiltered = statusFiltered.filter(row => {
      if (!row || typeof row !== 'object') {
        return false;
      }

      const rowSource = row.source;

      // Handle missing or non-string source
      if (typeof rowSource !== 'string') {
        return false;
      }

      // Exact match (case-sensitive)
      return rowSource.trim().toLowerCase() === sourceMode;
    });
  }

  // --- STAGE 4: Deduplication by Username ---
  // Deduplicate rows based on lowercase username
  // Keep the first occurrence and discard subsequent duplicates
  const seenUsernames = new Set();
  const deduplicated = [];

  for (const row of sourceFiltered) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const username = row.username;

    // Skip rows without valid username
    if (!username || typeof username !== 'string' || username.trim() === '') {
      continue;
    }

    // Username is already normalized to lowercase by sheetsManager
    const normalizedUsername = username.toLowerCase().trim();

    // Skip if we've already seen this username
    if (seenUsernames.has(normalizedUsername)) {
      continue;
    }

    // Mark as seen and add to result
    seenUsernames.add(normalizedUsername);
    deduplicated.push(row);
  }

  // --- STAGE 5: Apply Process Limit ---
  // Return no more than MAX_PROCCESS entries
  const limited = deduplicated.slice(0, maxProcess);

  return limited;
}

module.exports = {
  loadFilteredDatabase,
};


