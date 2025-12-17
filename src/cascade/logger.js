import winston from "winston";

let logger;

/**
 * Initialize the logger with specified level
 * @param {string} level - Log level: 'error', 'info', or 'debug'
 * @returns {winston.Logger} Winston logger instance
 */
export function initLogger(level = "info") {
  logger = winston.createLogger({
    level: level.toLowerCase(),
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: "HH:mm:ss" }),
      winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] [Cascade] ${level}: ${message}`),
    ),
    transports: [new winston.transports.Console()],
  });
  return logger;
}

/**
 * Get the current logger instance, initializing if needed
 * @returns {winston.Logger} Winston logger instance
 */
export function getLogger() {
  return logger || initLogger();
}
