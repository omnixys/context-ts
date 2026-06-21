import { ContextAccessor } from '../interceptor/context.store.js';
import type {
  CorrelationIdResolver,
  RequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import type { ClientIpResolver } from '../resolvers/ip.resolver.js';
import type { ContextModuleOptions } from './context-options.js';
import {
  CONTEXT_CLIENT_IP_RESOLVER,
  CONTEXT_CORRELATION_ID_RESOLVER,
  CONTEXT_OPTIONS,
  CONTEXT_REQUEST_ID_RESOLVER,
} from './context.constants.js';
import {
  createRequestContextSnapshot,
  type ContextRequestLike,
} from './request-context.factory.js';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

interface ContextResponseLike {
  header?(name: string, value: string): unknown;
  setHeader?(name: string, value: string): unknown;
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(CONTEXT_OPTIONS)
    private readonly options: ContextModuleOptions,
    @Inject(CONTEXT_REQUEST_ID_RESOLVER)
    private readonly requestIdResolver: RequestIdResolver,
    @Inject(CONTEXT_CORRELATION_ID_RESOLVER)
    private readonly correlationIdResolver: CorrelationIdResolver,
    @Inject(CONTEXT_CLIENT_IP_RESOLVER)
    private readonly clientIpResolver: ClientIpResolver,
  ) {}

  use(
    request: ContextRequestLike,
    response: ContextResponseLike,
    next: () => void,
  ): void {
    const snapshot = createRequestContextSnapshot(
      request,
      this.options,
      this.requestIdResolver,
      this.correlationIdResolver,
      this.clientIpResolver,
    );

    setCorrelationResponseHeader(
      response,
      this.options,
      snapshot.correlationId,
    );
    ContextAccessor.run(snapshot, next);
  }
}

function setCorrelationResponseHeader(
  response: ContextResponseLike,
  options: ContextModuleOptions,
  correlationId: string,
): void {
  const name =
    options.responseCorrelationIdHeader === false
      ? undefined
      : (options.responseCorrelationIdHeader ?? 'x-correlation-id');
  if (!name) return;

  if (response.header) response.header(name, correlationId);
  else response.setHeader?.(name, correlationId);
}
