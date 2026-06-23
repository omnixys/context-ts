import { getOptionalRequest, getRequest } from './get-request.util.js';
import { normalizeIp } from './normalize-ip.util.js';
import type { ExecutionContext } from '@nestjs/common';

export function getIp(context: ExecutionContext): string | undefined {
const req = getOptionalRequest(context);

if (!req) {
  return undefined;
}

  // 1️⃣ Cloudflare (höchste Priorität)
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) {
    return normalizeIp(cfIp);
  }

  // 2️⃣ X-Forwarded-For (first client IP)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    const ip = xForwardedFor.split(',')[0]?.trim();
    if (ip) return normalizeIp(ip);
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return normalizeIp(xForwardedFor[0]);
  }

  // 3️⃣ X-Real-IP
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    return normalizeIp(realIp);
  }

  // 4️⃣ Fallbacks
  const fallback = req.ip || req.socket?.remoteAddress || 'unknown';

  return fallback ? normalizeIp(fallback) : undefined;
}
