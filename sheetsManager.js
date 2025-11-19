// sheetsManager.js
require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

/**
 * Expected sheet column structure (in order)
 */
const REQUIRED_HEADERS = [
  'Date Added',
  'Username',
  'Source',
  'Date Sent',
  'Message',
  'Status'
];

/**
 * Column indices for easy reference
 */
const COLUMN_INDICES = {
  DATE_ADDED: 0,
  USERNAME: 1,
  SOURCE: 2,
  DATE_SENT: 3,
  MESSAGE: 4,
  STATUS: 5
};

/**
 * Loads and validates Google service account credentials from environment variables.
 * Prefers GOOGLE_CREDENTIALS (inline JSON string) over GOOGLE_CREDENTIALS_PATH (file path).
 * 
 * @returns {Object} Parsed credentials object
 * @throws {Error} If credentials are missing or invalid
 */
function loadCredentials() {
  let credentials = null;

  // Prefer inline credentials from .env
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (parseError) {
      throw new Error(
        `Failed to parse GOOGLE_CREDENTIALS as JSON: ${parseError.message}. ` +
        `Ensure the value is a valid JSON string.`
      );
    }
  }
  // Fallback to credentials file
  else if (process.env.GOOGLE_CREDENTIALS_PATH) {
    if (!fs.existsSync(process.env.GOOGLE_CREDENTIALS_PATH)) {
      throw new Error(
        `GOOGLE_CREDENTIALS_PATH file not found: ${process.env.GOOGLE_CREDENTIALS_PATH}`
      );
    }

    try {
      const fileData = fs.readFileSync(process.env.GOOGLE_CREDENTIALS_PATH, 'utf8');
      credentials = JSON.parse(fileData);
    } catch (fileError) {
      throw new Error(
        `Failed to read or parse credentials file at ${process.env.GOOGLE_CREDENTIALS_PATH}: ${fileError.message}`
      );
    }
  }
  // Neither credential source provided
  else {
    throw new Error(
      'Missing Google credentials. Provide either GOOGLE_CREDENTIALS (JSON string) ' +
      'or GOOGLE_CREDENTIALS_PATH (file path) in environment variables.'
    );
  }

  // Validate credentials structure
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Invalid credentials: must be a JSON object');
  }

  if (!credentials.client_email || typeof credentials.client_email !== 'string') {
    throw new Error('Invalid credentials: missing or invalid client_email field');
  }

  if (!credentials.private_key || typeof credentials.private_key !== 'string') {
    throw new Error('Invalid credentials: missing or invalid private_key field');
  }

  return credentials;
}

/**
 * Validates that required environment variables are present.
 * 
 * @throws {Error} If required environment variables are missing
 */
function validateEnvironment() {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error('Missing required environment variable: GOOGLE_SHEET_ID');
  }

  if (!process.env.GOOGLE_SHEET_NAME) {
    throw new Error('Missing required environment variable: GOOGLE_SHEET_NAME');
  }
}

/**
 * Builds and returns an authenticated Google Sheets API client.
 * Loads credentials, validates environment, and creates a ready-to-use Sheets instance.
 * 
 * @returns {Object} Authenticated Google Sheets API client
 * @throws {Error} If authentication fails or environment is invalid
 */
async function buildSheetsClient() {
  validateEnvironment();
  const credentials = loadCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  return sheets;
}

/**
 * Validates that the sheet header row matches the expected structure.
 * 
 * @param {Array<string>} headerRow - Array of header values from the sheet
 * @throws {Error} If headers are missing, misordered, or mistyped
 */
function validateHeaders(headerRow) {
  if (!Array.isArray(headerRow)) {
    throw new Error('Header row must be an array');
  }

  if (headerRow.length < REQUIRED_HEADERS.length) {
    throw new Error(
      `Invalid sheet structure: expected ${REQUIRED_HEADERS.length} columns, ` +
      `found ${headerRow.length}. Required columns: ${REQUIRED_HEADERS.join(', ')}`
    );
  }

  for (let i = 0; i < REQUIRED_HEADERS.length; i++) {
    const expected = REQUIRED_HEADERS[i].trim();
    const actual = (headerRow[i] || '').trim();

    if (actual !== expected) {
      throw new Error(
        `Invalid sheet structure: column ${i + 1} (index ${i}) should be "${expected}", ` +
        `but found "${actual}". Ensure headers match exactly: ${REQUIRED_HEADERS.join(', ')}`
      );
    }
  }
}

/**
 * Loads all database rows from the configured Google Sheet.
 * Validates headers, converts rows to structured objects, and normalizes usernames.
 * 
 * @returns {Promise<Array<Object>>} Array of row objects with:
 *   - rowIndex: 1-based sheet row index
 *   - username: normalized lowercase username
 *   - source: source value from sheet
 *   - status: status value from sheet
 *   - rawRow: complete raw row array
 * @throws {Error} If sheet cannot be loaded or headers are invalid
 */
async function loadDatabaseRows() {
  validateEnvironment();
  const credentials = loadCredentials();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Fetch all values from the sheet
  const range = `${sheetName}!A:F`;
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });
  } catch (apiError) {
    throw new Error(
      `Failed to load sheet data: ${apiError.message}. ` +
      `Verify GOOGLE_SHEET_ID and GOOGLE_SHEET_NAME are correct and the service account has access.`
    );
  }

  const allRows = response.data.values || [];

  if (allRows.length === 0) {
    return [];
  }

  // Validate header row (first row)
  const headerRow = allRows[0];
  validateHeaders(headerRow);

  // Process data rows (skip header row)
  const dataRows = allRows.slice(1);
  const structuredRows = [];

  dataRows.forEach((row, index) => {
    // Skip completely blank rows
    if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      return;
    }

    // Extract values with safe defaults
    const username = (row[COLUMN_INDICES.USERNAME] || '').trim();
    const source = (row[COLUMN_INDICES.SOURCE] || '').trim();
    const status = (row[COLUMN_INDICES.STATUS] || '').trim();

    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase();

    // Create structured object
    structuredRows.push({
      rowIndex: index + 2, // +2 because: 0-based index + 1 for header row + 1 for 1-based sheet indexing
      username: normalizedUsername,
      source: source,
      status: status,
      rawRow: row, // Preserve full raw row array
    });
  });

  return structuredRows;
}

/**
 * Updates a single sheet row with draft metadata.
 * Updates only the Date Sent, Message, and Status columns.
 * 
 * @param {number} rowIndex - 1-based row index in the sheet
 * @param {string} dateSent - ISO timestamp string for Date Sent column
 * @param {string} message - Message text to save (can be empty string)
 * @param {string} [status] - Status to set (defaults to "Drafted")
 * @throws {Error} If update fails or rowIndex is invalid
 */
async function updateDraftData(rowIndex, dateSent, message, status = 'Drafted') {
  if (!Number.isInteger(rowIndex) || rowIndex < 2) {
    throw new Error(`Invalid rowIndex: ${rowIndex}. Must be an integer >= 2 (row 1 is header)`);
  }

  if (typeof dateSent !== 'string' || dateSent.trim() === '') {
    throw new Error('dateSent must be a non-empty string');
  }

  if (typeof message !== 'string') {
    throw new Error('message must be a string');
  }

  if (typeof status !== 'string' || status.trim() === '') {
    throw new Error('status must be a non-empty string');
  }

  validateEnvironment();
  const credentials = loadCredentials();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Update Date Sent (column D), Message (column E), Status (column F)
  // Range format: SheetName!D{row}:F{row}
  const range = `${sheetName}!D${rowIndex}:F${rowIndex}`;
  const values = [[dateSent, message, status]];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });
  } catch (apiError) {
    throw new Error(
      `Failed to update row ${rowIndex} in sheet: ${apiError.message}. ` +
      `Verify rowIndex is valid and the service account has write access.`
    );
  }
}

module.exports = {
  buildSheetsClient,
  loadDatabaseRows,
  updateDraftData,
};
