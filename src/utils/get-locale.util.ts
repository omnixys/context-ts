import { Locale } from '@omnixys/contracts';
import { getRequest } from './get-request.util.js';
import type { ExecutionContext } from '@nestjs/common';

export function getLocale(context: ExecutionContext): Locale {
  const req = getRequest(context);

  const header = req.headers['accept-language'];

  if (typeof header === 'string') {
    return header.split(',')[0] as Locale;
  }
  const payload = (req.cookies?.locale ??
    req.headers['accept-language']?.toString().split(',')[0] ??
    'en-US') as Locale;

  return payload;
}
