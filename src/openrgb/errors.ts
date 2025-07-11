/**
 * OpenRGB-specific error classes for better error handling and debugging
 */

export class OpenRGBError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'OpenRGBError';
  }
}

export class OpenRGBConnectionError extends OpenRGBError {
  constructor(
    message: string,
    public readonly address?: string,
    public readonly port?: number,
  ) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'OpenRGBConnectionError';
  }
}

export class OpenRGBProtocolError extends OpenRGBError {
  constructor(
    message: string,
    public readonly packetType?: number,
  ) {
    super(message, 'PROTOCOL_ERROR');
    this.name = 'OpenRGBProtocolError';
  }
}

export class OpenRGBParseError extends OpenRGBError {
  constructor(
    message: string,
    public readonly offset?: number,
    public readonly bufferSize?: number,
  ) {
    super(message, 'PARSE_ERROR');
    this.name = 'OpenRGBParseError';
  }
}

export class OpenRGBTimeoutError extends OpenRGBError {
  constructor(
    message: string,
    public readonly timeoutMs?: number,
  ) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'OpenRGBTimeoutError';
  }
}

/**
 * Type guard to check if an error is an OpenRGB-specific error
 */
export function isOpenRGBError(error: unknown): error is OpenRGBError {
  return error instanceof OpenRGBError;
}

/**
 * Creates a user-friendly error message from any error
 */
export function formatErrorMessage(error: unknown): string {
  if (isOpenRGBError(error)) {
    return `OpenRGB ${error.code || 'ERROR'}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
