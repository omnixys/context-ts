import { ContextAccessor } from '../accessor.js';
import { HttpException, HttpStatus } from '@nestjs/common';

export type TenantRequestErrorCode =
  | 'TENANT_HEADER_MISSING'
  | 'TENANT_HEADER_INVALID';

export interface TenantRequestErrorDetails {
  readonly code: TenantRequestErrorCode;
  readonly message: string;
  readonly httpStatus: number;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

function details(
  code: TenantRequestErrorCode,
  message: string,
  httpStatus: HttpStatus,
  metadata: Readonly<Record<string, unknown>> = {},
): TenantRequestErrorDetails {
  const context = ContextAccessor.get();
  return {
    code,
    message,
    httpStatus,
    requestId: context?.requestId ?? 'unscoped',
    correlationId: context?.correlationId ?? context?.requestId ?? 'unscoped',
    traceId: context?.trace?.traceId,
    metadata,
  };
}

export class TenantHeaderMissingException extends HttpException {
  readonly code = 'TENANT_HEADER_MISSING';
  readonly httpStatus = HttpStatus.BAD_REQUEST;
  readonly requestId!: string;
  readonly correlationId!: string;
  readonly traceId?: string;
  readonly metadata!: Readonly<Record<string, unknown>>;

  constructor(metadata: Readonly<Record<string, unknown>> = {}) {
    const body = details(
      'TENANT_HEADER_MISSING',
      'A tenant context is required for this operation',
      HttpStatus.BAD_REQUEST,
      metadata,
    );
    super(body, HttpStatus.BAD_REQUEST);
    Object.assign(this, body);
  }
}

export class TenantHeaderInvalidException extends HttpException {
  readonly code = 'TENANT_HEADER_INVALID';
  readonly httpStatus = HttpStatus.BAD_REQUEST;
  readonly requestId!: string;
  readonly correlationId!: string;
  readonly traceId?: string;
  readonly metadata!: Readonly<Record<string, unknown>>;

  constructor(metadata: Readonly<Record<string, unknown>> = {}) {
    const body = details(
      'TENANT_HEADER_INVALID',
      'The supplied tenant identifier is invalid',
      HttpStatus.BAD_REQUEST,
      metadata,
    );
    super(body, HttpStatus.BAD_REQUEST);
    Object.assign(this, body);
  }
}
