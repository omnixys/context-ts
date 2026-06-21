import { ContextInterceptor } from '../interceptor/context.interceptor.js';
import type {
  ContextModuleAsyncOptions,
  ContextModuleOptions,
  ContextOptionsFactory,
} from './context-options.js';
import {
  CONTEXT_CLIENT_IP_RESOLVER,
  CONTEXT_CORRELATION_ID_RESOLVER,
  CONTEXT_OPTIONS,
  CONTEXT_PRINCIPAL_RESOLVER,
  CONTEXT_REQUEST_ID_RESOLVER,
  CONTEXT_TENANT_RESOLVER,
  CONTEXT_TRUSTED_PROXY_POLICY,
} from './context.constants.js';
import { ContextMiddleware } from './context.middleware.js';
import { contextResolverProviders } from './context.providers.js';
import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

const DEFAULT_CONTEXT_OPTIONS: ContextModuleOptions = {};

@Module({
  providers: [
    { provide: CONTEXT_OPTIONS, useValue: DEFAULT_CONTEXT_OPTIONS },
    ...contextResolverProviders,
    ContextMiddleware,
    ContextInterceptor,
  ],
  exports: [
    CONTEXT_OPTIONS,
    CONTEXT_REQUEST_ID_RESOLVER,
    CONTEXT_CORRELATION_ID_RESOLVER,
    CONTEXT_CLIENT_IP_RESOLVER,
    CONTEXT_TRUSTED_PROXY_POLICY,
    CONTEXT_PRINCIPAL_RESOLVER,
    CONTEXT_TENANT_RESOLVER,
    ContextInterceptor,
  ],
})
export class ContextModule implements NestModule {
  constructor(
    @Inject(CONTEXT_OPTIONS)
    private readonly options: ContextModuleOptions,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }

  static forRoot(options: ContextModuleOptions = {}): DynamicModule {
    return createDynamicModule(
      { provide: CONTEXT_OPTIONS, useValue: options },
      options.global,
      options.registerGlobalInterceptor,
    );
  }

  static forRootAsync(options: ContextModuleAsyncOptions): DynamicModule {
    const providers = createAsyncOptionsProviders(options);

    return createDynamicModule(
      providers,
      options.global,
      options.registerGlobalInterceptor,
      options.imports,
      options.extraProviders,
    );
  }
}

function createDynamicModule(
  optionsProvider: Provider | Provider[],
  global = true,
  registerGlobalInterceptor = true,
  imports: ContextModuleAsyncOptions['imports'] = [],
  extraProviders: Provider[] = [],
): DynamicModule {
  return {
    module: ContextModule,
    global,
    imports,
    providers: [
      ...(Array.isArray(optionsProvider) ? optionsProvider : [optionsProvider]),
      ...extraProviders,
      ...(registerGlobalInterceptor
        ? [{ provide: APP_INTERCEPTOR, useExisting: ContextInterceptor }]
        : []),
    ],
  };
}

function createAsyncOptionsProviders(options: ContextModuleAsyncOptions): Provider[] {
  if (options.useFactory) {
    return [
      {
        provide: CONTEXT_OPTIONS,
        useFactory: options.useFactory,
        inject: [...(options.inject ?? [])],
      },
    ];
  }

  const factory = options.useExisting ?? options.useClass;
  if (!factory) {
    throw new TypeError('ContextModule.forRootAsync requires useFactory, useClass, or useExisting');
  }

  return [
    ...(options.useClass ? [{ provide: options.useClass, useClass: options.useClass }] : []),
    {
      provide: CONTEXT_OPTIONS,
      useFactory: (optionsFactory: ContextOptionsFactory) => optionsFactory.createContextOptions(),
      inject: [factory],
    },
  ];
}
