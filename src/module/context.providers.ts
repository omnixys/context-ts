import {
  DefaultCorrelationIdResolver,
  DefaultRequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import { DefaultClientIpResolver } from '../resolvers/ip.resolver.js';
import { DefaultPrincipalResolver } from '../resolvers/principal.resolver.js';
import { DefaultTenantResolver } from '../resolvers/tenant.resolver.js';
import { DenyAllTrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import type { ContextModuleOptions } from './context-options.js';
import {
  CONTEXT_CLIENT_IP_RESOLVER,
  CONTEXT_CORRELATION_ID_RESOLVER,
  CONTEXT_OPTIONS,
  CONTEXT_PRINCIPAL_RESOLVER,
  CONTEXT_REQUEST_ID_RESOLVER,
  CONTEXT_TENANT_RESOLVER,
  CONTEXT_TRUSTED_PROXY_POLICY,
} from './context.constants.js';
import type { Provider } from '@nestjs/common';

export const contextResolverProviders: Provider[] = [
  {
    provide: CONTEXT_TRUSTED_PROXY_POLICY,
    inject: [CONTEXT_OPTIONS],
    useFactory: (options: ContextModuleOptions) =>
      options.trustedProxyPolicy ?? new DenyAllTrustedProxyPolicy(),
  },
  {
    provide: CONTEXT_REQUEST_ID_RESOLVER,
    inject: [CONTEXT_OPTIONS],
    useFactory: (options: ContextModuleOptions) =>
      options.requestIdResolver ?? new DefaultRequestIdResolver(),
  },
  {
    provide: CONTEXT_CORRELATION_ID_RESOLVER,
    inject: [CONTEXT_OPTIONS],
    useFactory: (options: ContextModuleOptions) =>
      options.correlationIdResolver ?? new DefaultCorrelationIdResolver(),
  },
  {
    provide: CONTEXT_CLIENT_IP_RESOLVER,
    inject: [CONTEXT_OPTIONS, CONTEXT_TRUSTED_PROXY_POLICY],
    useFactory: (
      options: ContextModuleOptions,
      trustedProxyPolicy: DenyAllTrustedProxyPolicy,
    ) =>
      options.clientIpResolver ??
      new DefaultClientIpResolver(trustedProxyPolicy),
  },
  {
    provide: CONTEXT_PRINCIPAL_RESOLVER,
    inject: [CONTEXT_OPTIONS],
    useFactory: (options: ContextModuleOptions) =>
      options.principalResolver ?? new DefaultPrincipalResolver(),
  },
  {
    provide: CONTEXT_TENANT_RESOLVER,
    inject: [CONTEXT_OPTIONS],
    useFactory: (options: ContextModuleOptions) =>
      options.tenantResolver ?? new DefaultTenantResolver(options.tenant),
  },
];
