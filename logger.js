// logger.js
const fs = require('fs');
const path = require('path');

/**
 * Configuration for file logging
 * Set ENABLE_FILE_LOGGING=true in environment to enable
 */
const FILE_LOGGING_ENABLED = process.env.ENABLE_FILE_LOGGING === 'true';
const LOG_FILE_PATH = path.join(__dirname, 'automation.log');

/**
 * Formats current timestamp into human-readable format.
 * Format: YYYY-MM-DD HH:MM:SS
 * 
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Writes a log message to file if file logging is enabled.
 * Fails silently if file write fails to prevent crashing the program.
 * 
 * @param {string} message - The log message to write
 */
function writeToFile(message) {
  if (!FILE_LOGGING_ENABLED) {
    return;
  }

  try {
    // Append to log file with newline
    fs.appendFileSync(LOG_FILE_PATH, message + '\n', 'utf8');
  } catch (error) {
    // Silently fail - don't crash the program if logging fails
    // This could happen if disk is full, permissions issue, etc.
  }
}

/**
 * Logs an informational message.
 * Used for normal runtime information and status updates.
 * 
 * @param {string} message - The message to log
 */
function info(message) {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ℹ️  INFO: ${message}`;
  
  console.log(logMessage);
  writeToFile(logMessage);
}

/**
 * Logs a warning message.
 * Used for recoverable issues, unexpected states, or non-critical problems.
 * 
 * @param {string} message - The warning message to log
 */
function warn(message) {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ⚠️  WARN: ${message}`;
  
  console.warn(logMessage);
  writeToFile(logMessage);
}

/**
 * Logs an error message.
 * Used for errors, exceptions, and critical failures.
 * Should clearly highlight the error level.
 * 
 * @param {string} message - The error message to log
 */
function error(message) {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ❌ ERROR: ${message}`;
  
  console.error(logMessage);
  writeToFile(logMessage);
}

/**
 * Logs a section header.
 * Used to visually separate major steps, loops, or logical sections.
 * Provides clear visual separation in logs for easier scanning.
 * 
 * @param {string} title - The section title to display
 */
function section(title) {
  const timestamp = getTimestamp();
  const separator = '='.repeat(60);
  const logMessage = `\n${separator}\n[${timestamp}] 📋 ${title}\n${separator}`;
  
  console.log(logMessage);
  writeToFile(logMessage);
}

/**
 * Logs a success message.
 * Used for positive confirmations such as completed drafts, successful updates, etc.
 * 
 * @param {string} message - The success message to log
 */
function success(message) {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ✅ SUCCESS: ${message}`;
  
  console.log(logMessage);
  writeToFile(logMessage);
}

module.exports = {
  info,
  warn,
  error,
  section,
  success,
};


