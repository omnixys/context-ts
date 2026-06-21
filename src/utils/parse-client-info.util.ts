import type { ClientContext } from '../types/client-context.type.js';
import type { Locale } from '@omnixys/contracts';
import { UAParser } from 'ua-parser-js';

export function parseClientInfo(
  locale: Locale,
  location: string,
  userAgent?: string,
  ip?: string,
): ClientContext {
  if (!userAgent) {
    return {
      ip,
      userAgent,
      device: 'Unknown device',
      browser: 'Unknown browser',
      os: 'Unknown OS',
      locale,
      location,
    };
  }

  if (userAgent.includes('PostmanRuntime')) {
    return {
      ip,
      userAgent,
      device: 'Postman client',
      browser: 'Postman',
      os: 'Unknown OS',
      locale,
      location,
    };
  }

  if (userAgent.includes('minipass-fetch')) {
    return {
      ip,
      userAgent,
      device: 'Internal service',
      browser: 'Node.js',
      os: 'Server',
      locale,
      location,
    };
  }

  const parser = new UAParser(userAgent);

  const browser = parser.getBrowser().name ?? 'Unknown browser';
  const os = parser.getOS().name ?? 'Unknown OS';
  const device = parser.getDevice().model ?? `${browser} on ${os}`;

  return {
    ip,
    userAgent,
    device,
    browser,
    os,
    locale,
    location,
  };
}
