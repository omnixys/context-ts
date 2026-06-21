import { getHeaders } from '../utils/get-headers.util.js';
import { getIp } from '../utils/get-ip.util.js';
import { getLocale } from '../utils/get-locale.util.js';
import { parseClientInfo } from '../utils/parse-client-info.util.js';
import { resolveGeoLocation } from '../utils/resolve-geo-location.util.js';
import type { ClientContext } from '../types/client-context.type.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const ClientInfo = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientContext => {
    const headers = getHeaders(context);

    const uaHeader =
      headers['x-client-user-agent'] ??
      headers['x-forwarded-user-agent'] ??
      headers['user-agent'];

    const userAgent = Array.isArray(uaHeader) ? uaHeader[0] : uaHeader;

    const locale = getLocale(context);

    const ipAddress = getIp(context);
    const location = resolveGeoLocation(ipAddress);

    return parseClientInfo(locale, location, userAgent, ipAddress);
  },
);
