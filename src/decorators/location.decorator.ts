import { getIp } from '../utils/get-ip.util.js';
import { resolveGeoLocation } from '../utils/resolve-geo-location.util.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const Location = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const ipAddress = getIp(context);
    const location = resolveGeoLocation(ipAddress);

    // const headers = getHeaders(context);
    // const userAgent = headers['user-agent'];
    return location;
  },
);
