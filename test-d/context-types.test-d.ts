import type {
  ClientDeviceType,
  ClientMetadata,
  ContextSnapshot,
  ContextTransportType,
  PrincipalContext,
  RequestContext,
  TenantContext,
  TenantContextSource,
  TraceMetadata,
  TransportMetadata,
} from '../src/index.js';
import { ContextAccessor, ContextModule } from '../src/index.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

type _ActorIdCompatibility = Expect<
  Equal<RequestContext['actorId'], string | undefined>
>;
type _TenantIdCompatibility = Expect<
  Equal<RequestContext['tenantId'], string | undefined>
>;
type _RequestIdCompatibility = Expect<
  Equal<RequestContext['requestId'], string | undefined>
>;
type _IpCompatibility = Expect<Equal<RequestContext['ip'], string | undefined>>;
type _UserAgentCompatibility = Expect<
  Equal<RequestContext['userAgent'], string | undefined>
>;

const emptyLegacyContext: RequestContext = {};

const legacyContext: RequestContext = {
  actorId: 'actor-1',
  tenantId: 'tenant-1',
  requestId: 'request-1',
  ip: '127.0.0.1',
  userAgent: 'test-agent',
};

ContextAccessor.run(legacyContext, () => ContextAccessor.current());
ContextAccessor.get();
ContextAccessor.getOrThrow();
ContextModule.forRoot({});
ContextModule.forRootAsync({
  inject: ['CONFIG'],
  useFactory: (config: { requestIdHeader: string }) => ({
    requestIdHeader: config.requestIdHeader,
  }),
});

const principal: PrincipalContext = {
  subject: 'subject-1',
  actorId: 'actor-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  roles: ['USER'],
  sessionId: 'session-1',
  authStrength: 'mfa',
  authenticatedAtEpochMs: 1_700_000_000_000,
};

const tenantSource: TenantContextSource = 'principal';

const tenant: TenantContext = {
  tenantId: 'tenant-1',
  source: tenantSource,
  verified: true,
};

const transportType: ContextTransportType = 'graphql';

const transport: TransportMetadata = {
  type: transportType,
  operation: 'Query.currentUser',
};

const clientDeviceType: ClientDeviceType = 'desktop';

const client: ClientMetadata = {
  ip: '127.0.0.1',
  userAgent: 'test-agent',
  deviceId: 'device-1',
  locale: 'en-US',
  timezone: 'Europe/Berlin',
  browser: { name: 'Browser', version: '1' },
  os: { name: 'Operating System', version: '1' },
  device: { type: clientDeviceType, vendor: 'Vendor', model: 'Model' },
  location: {
    country: 'DE',
    region: 'BE',
    city: 'Berlin',
    source: 'explicit',
  },
};

const trace: TraceMetadata = {
  traceId: 'trace-1',
  spanId: 'span-1',
};

const snapshot: ContextSnapshot = {
  requestId: 'request-1',
  correlationId: 'correlation-1',
  startedAtEpochMs: 1_700_000_000_000,
  principal,
  tenant,
  client,
  transport,
  trace,
};

const extendedCompatibilityContext: RequestContext = {
  ...legacyContext,
  correlationId: snapshot.correlationId,
  userId: principal.userId,
  subject: principal.subject,
  roles: principal.roles,
  locale: client.locale,
  timezone: client.timezone,
  deviceId: client.deviceId,
  sessionId: principal.sessionId,
  authStrength: principal.authStrength,
  country: client.location?.country,
  region: client.location?.region,
  city: client.location?.city,
  browser: client.browser?.name,
  os: client.os?.name,
  deviceType: client.device?.type,
  traceId: trace.traceId,
  spanId: trace.spanId,
  startedAtEpochMs: snapshot.startedAtEpochMs,
  transportType: transport.type,
  route: transport.route,
  operation: transport.operation,
  principal,
  tenant,
  client,
  transport,
  trace,
};

// @ts-expect-error ContextSnapshot is immutable.
snapshot.requestId = 'request-2';

const principalWithToken: PrincipalContext = {
  subject: 'subject-1',
  roles: [],
  // @ts-expect-error Raw access tokens are not principal context metadata.
  accessToken: 'secret',
};

void emptyLegacyContext;
void extendedCompatibilityContext;
void principalWithToken;
