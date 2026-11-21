export type WebLiveErrorCode =
  | 'NETWORK_ERROR'
  | 'PLATFORM_RESTRICTED'
  | 'UNAVAILABLE'
  | 'CUSTOM_URL_EXPIRED'
  | 'PLAYBACK_ENDED';

export class WebLiveResolveError extends Error {
  readonly code: WebLiveErrorCode;
  readonly retryable: boolean;

  constructor(code: WebLiveErrorCode, message: string, retryable = true) {
    super(message);
    this.name = 'WebLiveResolveError';
    this.code = code;
    this.retryable = retryable;
    Object.setPrototypeOf(this, WebLiveResolveError.prototype);
  }
}
