import type { GqlFastifyContext } from '../types/gql-context.js';
import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { FastifyRequest } from 'fastify';

export function getOptionalRequest(
  context: ExecutionContext,
): FastifyRequest | undefined {
  const type = context.getType<string>();

  if (type === 'http') {
    return context.switchToHttp().getRequest<FastifyRequest>();
  }

  if (type === 'graphql') {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<GqlFastifyContext>();

    return ctx?.req;
  }

  return undefined;
}

export function getRequest(context: ExecutionContext): FastifyRequest {
  const req = getOptionalRequest(context);

  if (!req) {
    throw new Error(
      `Request unavailable for context type '${context.getType<string>()}'`,
    );
  }

  return req;
}

// export function getRequest(context: ExecutionContext): FastifyRequest {
//   const type = context.getType<string>();

//   if (type === 'http') {
//     return context.switchToHttp().getRequest<FastifyRequest>();
//   }

//   if (type === 'graphql') {
//     const gqlCtx = GqlExecutionContext.create(context);
//     const ctx = gqlCtx.getContext<GqlFastifyContext>();
//     return ctx.req;
//   }

//   throw new Error(`Unsupported context type: ${type}`);
// }
