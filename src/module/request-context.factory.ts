import type {
  CorrelationIdResolver,
  RequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import type { ClientIpResolver } from '../resolvers/ip.resolver.js';
import { getRequestTraceContext } from '../trace/request-trace-context.js';
import type { ContextSnapshot } from '../types/context-snapshot.type.js';
import type { ContextModuleOptions } from './context-options.js';

export interface ContextRequestLike {
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly method?: string;
  readonly protocol?: string;
  readonly hostname?: string;
  readonly url?: string;
  readonly ip?: string;
  readonly socket?: { readonly remoteAddress?: string };
  readonly routeOptions?: { readonly url?: string };
}

export function createRequestContextSnapshot(
  request: ContextRequestLike | undefined,
  options: ContextModuleOptions,
  requestIdResolver: RequestIdResolver,
  correlationIdResolver: CorrelationIdResolver,
  clientIpResolver: ClientIpResolver,
): ContextSnapshot {
  const headers = request?.headers ?? {};
  const requestIdHeader = options.requestIdHeader ?? 'x-request-id';
  const correlationIdHeader = options.correlationIdHeader ?? 'x-correlation-id';
  const requestId = requestIdResolver.resolve(headers[requestIdHeader]);
  const correlationId = correlationIdResolver.resolve(
    headers[correlationIdHeader],
    requestId,
  );
  const peerAddress = request?.socket?.remoteAddress ?? request?.ip;
  const userAgent = firstString(headers['user-agent']);

  return {
    requestId,
    correlationId,
    startedAtEpochMs: Date.now(),
    client: {
      ip: clientIpResolver.resolve({
        peerAddress,
        forwardedFor: headers['x-forwarded-for'],
        realIp: headers['x-real-ip'],
        connectingIp: headers['cf-connecting-ip'],
      }),
      userAgent,
    },
    transport: {
      type: 'http',
      method: request?.method,
      route: request?.routeOptions?.url ?? request?.url,
      protocol: request?.protocol,
      host: firstString(headers.host) ?? request?.hostname,
    },
    trace: getRequestTraceContext(request),
  };
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  return value.find((entry): entry is string => typeof entry === 'string');
}
