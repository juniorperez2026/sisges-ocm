import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOCK, type Clock } from '../../shared/application/clock';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/id-generator';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { UuidIdGenerator } from '../../shared/infrastructure/uuid-id-generator';
import { AgentsModule } from '../agents/agents.module';
import { GetAgentSessionUseCase } from '../agents/application/use-cases/get-agent-session.use-case';
import { GetCallablePhonesByDebtorUseCase } from '../phones/application/use-cases/get-callable-phones-by-debtor.use-case';
import { PhonesModule } from '../phones/phones.module';
import {
  CALL_REPOSITORY,
  type CallRepository,
} from './application/ports/call.repository';
import { CancelCallUseCase } from './application/use-cases/cancel-call.use-case';
import { CreateCallUseCase } from './application/use-cases/create-call.use-case';
import { GetCallUseCase } from './application/use-cases/get-call.use-case';
import { CallStatusTransitionPolicy } from './domain/call-status-transition.policy';
import { InMemoryCallRepository } from './infrastructure/persistence/in-memory-call.repository';
import { SqlServerCallRepository } from './infrastructure/persistence/sql-server-call.repository';
import { CallsController } from './presentation/http/calls.controller';

const infrastructureProviders: Provider[] = [
  {
    provide: CLOCK,
    useClass: SystemClock,
  },

  {
    provide: ID_GENERATOR,
    useClass: UuidIdGenerator,
  },

  {
    provide: CallStatusTransitionPolicy,

    useFactory: () => new CallStatusTransitionPolicy(),
  },

  InMemoryCallRepository,
  SqlServerCallRepository,

  {
    provide: CALL_REPOSITORY,

    inject: [ConfigService, InMemoryCallRepository, SqlServerCallRepository],

    useFactory: (
      configService: ConfigService,

      inMemoryRepository: InMemoryCallRepository,

      sqlServerRepository: SqlServerCallRepository,
    ): CallRepository => {
      const sqlEnabled =
        configService.get<boolean>('SQL_SERVER_ENABLED') ?? false;

      return sqlEnabled ? sqlServerRepository : inMemoryRepository;
    },
  },
];

const applicationProviders: Provider[] = [
  {
    provide: CreateCallUseCase,

    inject: [
      CALL_REPOSITORY,
      GetAgentSessionUseCase,
      GetCallablePhonesByDebtorUseCase,
      ID_GENERATOR,
      CLOCK,
    ],

    useFactory: (
      repository: CallRepository,

      getAgentSession: GetAgentSessionUseCase,

      getCallablePhones: GetCallablePhonesByDebtorUseCase,

      idGenerator: IdGenerator,

      clock: Clock,
    ) =>
      new CreateCallUseCase(
        repository,
        getAgentSession,
        getCallablePhones,
        idGenerator,
        clock,
      ),
  },

  {
    provide: GetCallUseCase,

    inject: [CALL_REPOSITORY],

    useFactory: (repository: CallRepository) => new GetCallUseCase(repository),
  },

  {
    provide: CancelCallUseCase,

    inject: [CALL_REPOSITORY, CLOCK, CallStatusTransitionPolicy],

    useFactory: (
      repository: CallRepository,

      clock: Clock,

      policy: CallStatusTransitionPolicy,
    ) => new CancelCallUseCase(repository, clock, policy),
  },
];

@Module({
  imports: [DatabaseModule, AgentsModule, PhonesModule],

  controllers: [CallsController],

  providers: [...infrastructureProviders, ...applicationProviders],
})
export class CallsModule {}
