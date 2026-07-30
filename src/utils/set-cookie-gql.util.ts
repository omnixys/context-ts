import { accessToken, refreshToken } from '../const/cookie.const.js';
import { cookieOpts } from './get-cookies.util.js';
import type { FastifyReply } from 'fastify';

/**
 * Safely sets a cookie on the response if available.
 *
 * @param res - Express response object.
 * @param name - The cookie name.
 * @param value - The cookie value.
 * @param opts - Additional cookie options.
 */
/** @deprecated Use the security package's cookie services for policy-controlled cookies. */
export function gqlSetCookieSafe(
  reply: FastifyReply,
  name: string,
  value: string,
  maxAgeMs?: number,
): void {
  reply.setCookie(name, value, cookieOpts(maxAgeMs));
}

/**
 * Safely clears a cookie from the response if available.
 *
 * @param res - Express response object.
 * @param name - The cookie name to remove.
 */
/** @deprecated Use the security package's cookie services for policy-controlled cookies. */
export function gqlClearCookieSafe(reply: FastifyReply, name: string): void {
  reply.clearCookie(name, cookieOpts());
}

/**
 * @deprecated Use `TokenCookieService.setTokens()` from `@omnixys/security-ts`.
 * This legacy API writes one value into both token cookies.
 */
export function gqlSetTokens(
  reply: FastifyReply,
  value: string,
  maxAgeMs?: number,
) {
  gqlSetCookieSafe(reply, accessToken, value, maxAgeMs);

  gqlSetCookieSafe(reply, refreshToken, value, maxAgeMs);
}

/** @deprecated Use `TokenCookieService.clearTokens()` from `@omnixys/security-ts`. */
export function gqlClearTokens(reply: FastifyReply) {
  gqlClearCookieSafe(reply, accessToken);
  gqlClearCookieSafe(reply, refreshToken);
}
