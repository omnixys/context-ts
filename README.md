# @omnixys/context

Shared request context utilities and decorators for Omnixys backend services.

This package provides a unified way to access the **HTTP / GraphQL request context**
inside NestJS applications using Fastify.

It removes the need to manually handle `ExecutionContext`, `GqlExecutionContext`,
or Fastify request objects throughout your codebase.

The utilities and decorators work transparently for both:

- HTTP Controllers
- GraphQL Resolvers

---

# Purpose

In a microservice architecture many services require access to the same
request-level information:

- request object
- response object
- cookies
- headers
- client IP
- locale

Instead of duplicating logic across services, `@omnixys/context` centralizes
all request context handling.

Typical consumers include:

- `@omnixys/auth`
- logging services
- audit logging
- tracing / telemetry
- rate limiting
- notifications
- analytics

---

# Features

- HTTP + GraphQL compatible
- Works with **NestJS + Fastify**
- Zero dependencies on auth or business logic
- Typed request access
- Clean decorators for controllers and resolvers

---

# Installation

Inside the Omnixys monorepo the package can be used directly:

```ts
import { ClientIp } from '@omnixys/context'
````

If published as a package:

```
pnpm add @omnixys/context
```

---

# Supported Environment

This package assumes the following stack:

* NestJS
* Fastify adapter
* GraphQL (optional)
* TypeScript

GraphQL support requires a context object containing:

```ts
{
  req: FastifyRequest
  reply: FastifyReply
}
```

Example:

```ts
GraphQLModule.forRoot({
  context: ({ req, reply }) => ({ req, reply })
})
```

---

# Canonical module setup

`ContextModule` starts the async context scope in middleware, before NestJS
guards run, and enriches it after authentication in the global interceptor.

```ts
import {
  AddressListTrustedProxyPolicy,
  ContextModule,
} from '@omnixys/context'

@Module({
  imports: [
    ContextModule.forRoot({
      trustedProxyPolicy: new AddressListTrustedProxyPolicy([
        '10.0.0.8',
      ]),
      tenant: {
        trustedHostSuffixes: ['app.omnixys.com'],
      },
    }),
  ],
})
export class AppModule {}
```

Forwarded client and tenant headers are ignored unless the immediate peer is
trusted. Use `ContextAccessor.get()` for optional access and
`ContextAccessor.getOrThrow()` where an active scope is required.

```ts
const context = ContextAccessor.getOrThrow()
context.requestId
context.correlationId
context.principal?.actorId
context.tenant?.tenantId
```

---

# Utilities

Utilities allow low-level access to request data using `ExecutionContext`.

They are typically used inside:

* guards
* interceptors
* custom decorators
* services

---

## getRequest

Returns the Fastify request object for HTTP or GraphQL.

```ts
import { getRequest } from '@omnixys/context'

const req = getRequest(context)
```

---

## getResponse

Returns the Fastify response object.

```ts
import { getResponse } from '@omnixys/context'

const res = getResponse(context)
```

---

## getCookies

Returns request cookies.

```ts
import { getCookies } from '@omnixys/context'

const cookies = getCookies(context)
```

---

## getHeaders

Returns request headers.

```ts
import { getHeaders } from '@omnixys/context'

const headers = getHeaders(context)
```

---

## getIp

Returns the best available client IP.

This is a legacy compatibility utility and reads forwarding headers directly.
New code should read `ContextAccessor.get()?.client.ip`, which is populated by
the configured trusted-proxy policy.

The resolver checks in order:

1. `cf-connecting-ip`
2. `x-forwarded-for`
3. `req.ip`
4. socket remote address

```ts
import { getIp } from '@omnixys/context'

const ip = getIp(context)
```

---

## getLocale

Resolves the locale from the request.

Priority order:

1. `locale` cookie
2. `Accept-Language` header
3. default `en-US`

```ts
import { getLocale } from '@omnixys/context'

const locale = getLocale(context)
```

---

# Decorators

Decorators provide a clean way to inject request context into
controllers and resolvers.

---

## @ClientIp()

Returns the resolved client IP.

```ts
import { ClientIp } from '@omnixys/context'

@Get()
getProfile(@ClientIp() ip: string) {
  return ip
}
```

---

## @RequestHeaders()

Returns request headers.

```ts
import { RequestHeaders } from '@omnixys/context'

@Get()
test(@RequestHeaders() headers) {
  return headers['user-agent']
}
```

---

## @RequestCookies()

Returns request cookies.

```ts
import { RequestCookies } from '@omnixys/context'

@Get()
test(@RequestCookies() cookies) {
  return cookies.session
}
```

---

## @RequestContext()

Returns the raw Fastify request.

```ts
import { RequestContext } from '@omnixys/context'

@Get()
test(@RequestContext() req) {
  return req.url
}
```

---

## @ResponseContext()

Returns the raw Fastify response.

```ts
import { ResponseContext } from '@omnixys/context'

@Get()
test(@ResponseContext() res) {
  res.header('x-service', 'omnixys')
}
```

---

# Example — Controller

```ts
import {
  ClientIp,
  RequestHeaders,
  RequestCookies
} from '@omnixys/context'

@Controller('example')
export class ExampleController {

  @Get()
  test(
    @ClientIp() ip: string,
    @RequestHeaders() headers,
    @RequestCookies() cookies
  ) {
    return {
      ip,
      userAgent: headers['user-agent'],
      session: cookies.session
    }
  }
}
```

---

# Example — GraphQL Resolver

```ts
import { ClientIp } from '@omnixys/context'

@Resolver()
export class UserResolver {

  @Query(() => String)
  clientIp(@ClientIp() ip: string) {
    return ip
  }
}
```

---

# Best Practices

### Use decorators inside controllers and resolvers

Prefer:

```
@ClientIp()
@RequestHeaders()
```

Instead of manually accessing `ExecutionContext`.

---

### Use utilities inside guards or interceptors

Utilities are useful when working directly with `ExecutionContext`.

Example:

```ts
const req = getRequest(context)
```

---

### Do not put authentication logic in this package

`@omnixys/context` is **framework infrastructure only**.

Authentication belongs in:

```
@omnixys/auth
```

---

# Architecture

```
@omnixys/context
│
├─ decorators
│  ├─ client-ip.decorator.ts
│  ├─ request-headers.decorator.ts
│  ├─ request-cookies.decorator.ts
│  ├─ request-context.decorator.ts
│  └─ response-context.decorator.ts
│
├─ utils
│  ├─ get-request.util.ts
│  ├─ get-response.util.ts
│  ├─ get-cookies.util.ts
│  ├─ get-headers.util.ts
│  ├─ get-ip.util.ts
│  └─ get-locale.util.ts
```

---

# When to use this package

Use this package whenever a service needs access to:

* request metadata
* headers
* cookies
* client IP
* locale
* raw request/response

This package is designed to be used by **all Omnixys backend services**.

---

# License

GPL-3.0-or-later

Copyright (C) Omnixys Technologies
