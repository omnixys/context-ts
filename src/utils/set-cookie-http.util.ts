import { accessToken, refreshToken } from '../const/cookie.const.js';
import { cookieOpts } from './get-cookies.util.js';
import { getResponse } from './get-response.util.js';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Safely sets a cookie on the response if available.
 *
 * @param res - Express response object.
 * @param name - The cookie name.
 * @param value - The cookie value.
 * @param opts - Additional cookie options.
 */
/** @deprecated Use the security package's cookie services for policy-controlled cookies. */
export function httpSetCookieSafe(
  context: ExecutionContext,
  name: string,
  value: string,
  maxAgeMs?: number,
): void {
  const reply = getResponse(context);

  if (!reply) return;

  reply.setCookie(name, value, cookieOpts(maxAgeMs));
}

/**
 * Safely clears a cookie from the response if available.
 *
 * @param res - Express response object.
 * @param name - The cookie name to remove.
 */
/** @deprecated Use the security package's cookie services for policy-controlled cookies. */
export function httpClearCookieSafe(
  context: ExecutionContext,
  name: string,
): void {
  const reply = getResponse(context);

  if (!reply) return;

  reply.clearCookie(name, cookieOpts());
}

/**
 * @deprecated Use `TokenCookieService.setTokens()` from `@omnixys/security`.
 * This legacy API writes one value into both token cookies.
 */
export function httpSetTokens(
  context: ExecutionContext,
  value: string,
  maxAgeMs?: number,
) {
  httpSetCookieSafe(context, accessToken, value, maxAgeMs);

  httpSetCookieSafe(context, refreshToken, value, maxAgeMs);
}

/** @deprecated Use `TokenCookieService.clearTokens()` from `@omnixys/security`. */
export function httpClearTokens(context: ExecutionContext) {
  httpClearCookieSafe(context, accessToken);
  httpClearCookieSafe(context, refreshToken);
}
