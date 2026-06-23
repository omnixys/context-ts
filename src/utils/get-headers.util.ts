import { getOptionalRequest, getRequest } from './get-request.util.js';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export function getHeaders(
  context: ExecutionContext,
): FastifyRequest['headers'] {
  return getOptionalRequest(context)?.headers ?? {};
}
