import type { PrincipalContext } from '../types/principal-context.type.js';
import type { TenantContext } from '../types/tenant-context.type.js';
import { resolveIdentifier } from './identifier.resolver.js';

export type TenantResolutionMode = 'strict' | 'legacy';

export interface TenantResolverOptions {
  readonly mode?: TenantResolutionMode;
  readonly trustedHostSuffixes?: readonly string[];
  readonly defaultTenantId?: string;
  readonly rejectConflicts?: boolean;
}

export interface TenantResolutionInput {
  readonly principal?: PrincipalContext;
  readonly headerTenantId?: unknown;
  readonly headerTrusted?: boolean;
  readonly host?: string;
  readonly serviceTenantId?: string;
  /** Compatibility input used only when `mode` is explicitly `legacy`. */
  readonly legacyAzp?: string;
}

export interface TenantResolver {
  resolve(input: TenantResolutionInput): TenantContext | undefined;
}

export class TenantResolutionConflictError extends Error {
  constructor(readonly tenantIds: readonly string[]) {
    super(`Conflicting tenant identities: ${tenantIds.join(', ')}`);
    this.name = TenantResolutionConflictError.name;
  }
}

export class DefaultTenantResolver implements TenantResolver {
  private readonly mode: TenantResolutionMode;
  private readonly rejectConflicts: boolean;

  constructor(private readonly options: TenantResolverOptions = {}) {
    this.mode = options.mode ?? 'strict';
    this.rejectConflicts = options.rejectConflicts ?? this.mode === 'strict';
  }

  resolve(input: TenantResolutionInput): TenantContext | undefined {
    const candidates = this.candidates(input);
    const tenantIds = [...new Set(candidates.map(({ tenantId }) => tenantId))];

    if (this.rejectConflicts && tenantIds.length > 1) {
      throw new TenantResolutionConflictError(tenantIds);
    }

    return candidates[0];
  }

  private candidates(input: TenantResolutionInput): TenantContext[] {
    const candidates: TenantContext[] = [];

    addCandidate(candidates, input.principal?.tenantId, 'principal', true);
    addCandidate(candidates, input.serviceTenantId, 'service-context', true);

    if (input.headerTrusted || this.mode === 'legacy') {
      addCandidate(
        candidates,
        resolveIdentifier(input.headerTenantId),
        'trusted-header',
        input.headerTrusted === true,
      );
    }

    addCandidate(
      candidates,
      resolveHostTenant(input.host, this.options.trustedHostSuffixes),
      'trusted-host',
      true,
    );

    if (this.mode === 'legacy') {
      addCandidate(candidates, input.legacyAzp, 'principal', false);
    }

    if (candidates.length === 0) {
      addCandidate(
        candidates,
        this.options.defaultTenantId,
        'configured-default',
        false,
      );
    }

    return candidates;
  }
}

function addCandidate(
  candidates: TenantContext[],
  candidate: string | undefined,
  source: TenantContext['source'],
  verified: boolean,
): void {
  const tenantId = resolveIdentifier(candidate);
  if (tenantId) candidates.push({ tenantId, source, verified });
}

function resolveHostTenant(
  host: string | undefined,
  trustedHostSuffixes: readonly string[] | undefined,
): string | undefined {
  if (!host || !trustedHostSuffixes?.length) return undefined;

  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '');
  for (const configuredSuffix of trustedHostSuffixes) {
    const suffix = configuredSuffix.trim().toLowerCase().replace(/^\./, '');
    if (!suffix || !hostname.endsWith(`.${suffix}`)) continue;

    const prefix = hostname.slice(0, -(suffix.length + 1));
    if (prefix && !prefix.includes('.')) return resolveIdentifier(prefix);
  }

  return undefined;
}
