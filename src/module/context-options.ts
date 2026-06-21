import type {
  CorrelationIdResolver,
  RequestIdResolver,
} from '../resolvers/identifier.resolver.js';
import type { ClientIpResolver } from '../resolvers/ip.resolver.js';
import type { PrincipalResolver } from '../resolvers/principal.resolver.js';
import type {
  TenantResolver,
  TenantResolverOptions,
} from '../resolvers/tenant.resolver.js';
import type { TrustedProxyPolicy } from '../resolvers/trusted-proxy.policy.js';
import type { ModuleMetadata, Provider, Type } from '@nestjs/common';

export interface ContextModuleOptions {
  readonly global?: boolean;
  readonly registerGlobalInterceptor?: boolean;
  readonly requestIdHeader?: string;
  readonly correlationIdHeader?: string;
  readonly tenantHeader?: string;
  readonly responseCorrelationIdHeader?: string | false;
  readonly trustedProxyPolicy?: TrustedProxyPolicy;
  readonly requestIdResolver?: RequestIdResolver;
  readonly correlationIdResolver?: CorrelationIdResolver;
  readonly clientIpResolver?: ClientIpResolver;
  readonly principalResolver?: PrincipalResolver;
  readonly tenantResolver?: TenantResolver;
  readonly tenant?: TenantResolverOptions;
}

export interface ContextOptionsFactory {
  createContextOptions(): ContextModuleOptions | Promise<ContextModuleOptions>;
}

export interface ContextModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  readonly global?: boolean;
  readonly registerGlobalInterceptor?: boolean;
  readonly useFactory?: (
    ...args: any[]
  ) => ContextModuleOptions | Promise<ContextModuleOptions>;
  readonly inject?: readonly any[];
  readonly useClass?: Type<ContextOptionsFactory>;
  readonly useExisting?: Type<ContextOptionsFactory>;
  readonly extraProviders?: Provider[];
}
