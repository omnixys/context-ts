/**
 * Omnixys unified request abstraction.
 * Decouples internal utilities from Fastify/Express specifics.
 */

import type { AuthUser } from '@omnixys/contracts-ts';
import type { PrincipalContext } from './principal-context.type.js';

export interface OmnixysHeaders {
  [key: string]: string | string[] | undefined;
}

export interface OmnixysCookies {
  access_token?: string;
  refresh_token?: string;
  [key: string]: string | undefined;
}

export interface OmnixysSocket {
  remoteAddress?: string;
}

export interface OmnixysRequest {
  headers: OmnixysHeaders;

  cookies?: OmnixysCookies;

  ip?: string;

  socket?: OmnixysSocket;

  user?: AuthUser;

  /** Verified principal metadata supplied by the security integration. */
  contextPrincipal?: PrincipalContext;

  /**
   * Raw request reference (Fastify / Express / etc.)
   * Escape hatch for advanced use cases.
   */
  raw?: unknown;
}

// type OmnixysRequest = FastifyRequest & {
//   headers: IncomingHttpHeaders;
//   ip?: string;
//   socket?: {
//     remoteAddress?: string;
//   };
//   userAgent?: string;
// };
