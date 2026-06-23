import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import process from 'node:process';

import { getOptionalRequest, getRequest } from './get-request.util.js';

const isProd = process.env.NODE_ENV === 'production';

export function getCookies(
  context: ExecutionContext,
): FastifyRequest['cookies'] {
const req = getOptionalRequest(context);

return req?.cookies ?? {};
}

/**
 * Creates a configured set of cookie options based on the runtime environment.
 *
 * @param maxAgeMs - The cookie lifetime in milliseconds.
 * @returns Express-compatible {@link CookieOptions}.
 */
/**
 * @deprecated Cookie security policy is owned by `@omnixys/security`. This
 * compatibility helper will remain available until the next major version.
 */
export const cookieOpts = (maxAgeMs?: number) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : ('lax' as CookieSameSite),
  domain: isProd ? '.omnixys.com' : undefined,
  path: '/',
  maxAge: maxAgeMs,
});
