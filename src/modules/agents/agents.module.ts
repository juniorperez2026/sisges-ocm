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
import {
  AGENT_SESSION_REPOSITORY,
  type AgentSessionRepository,
} from './application/ports/agent-session.repository';
import { ChangeAgentStatusUseCase } from './application/use-cases/change-agent-status.use-case';
import { DisconnectAgentSessionUseCase } from './application/use-cases/disconnect-agent-session.use-case';
import { GetAgentSessionUseCase } from './application/use-cases/get-agent-session.use-case';
import { HeartbeatAgentSessionUseCase } from './application/use-cases/heartbeat-agent-session.use-case';
import { StartAgentSessionUseCase } from './application/use-cases/start-agent-session.use-case';
import { AgentStatusTransitionPolicy } from './domain/agent-status-transition.policy';
import { InMemoryAgentSessionRepository } from './infrastructure/persistence/in-memory-agent-session.repository';
import { SqlServerAgentSessionRepository } from './infrastructure/persistence/sql-server-agent-session.repository';
import { AgentSessionsController } from './presentation/http/agent-sessions.controller';

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
    provide: AgentStatusTransitionPolicy,

    useFactory: () => new AgentStatusTransitionPolicy(),
  },

  InMemoryAgentSessionRepository,
  SqlServerAgentSessionRepository,

  {
    provide: AGENT_SESSION_REPOSITORY,

    inject: [
      ConfigService,
      InMemoryAgentSessionRepository,
      SqlServerAgentSessionRepository,
    ],

    useFactory: (
      configService: ConfigService,

      inMemoryRepository: InMemoryAgentSessionRepository,

      sqlServerRepository: SqlServerAgentSessionRepository,
    ): AgentSessionRepository => {
      const sqlServerEnabled =
        configService.get<boolean>('SQL_SERVER_ENABLED') ?? false;

      return sqlServerEnabled ? sqlServerRepository : inMemoryRepository;
    },
  },
];

const applicationProviders: Provider[] = [
  {
    provide: StartAgentSessionUseCase,

    inject: [AGENT_SESSION_REPOSITORY, ID_GENERATOR, CLOCK],

    useFactory: (
      repository: AgentSessionRepository,

      idGenerator: IdGenerator,

      clock: Clock,
    ) => new StartAgentSessionUseCase(repository, idGenerator, clock),
  },

  {
    provide: GetAgentSessionUseCase,

    inject: [AGENT_SESSION_REPOSITORY],

    useFactory: (repository: AgentSessionRepository) =>
      new GetAgentSessionUseCase(repository),
  },

  {
    provide: ChangeAgentStatusUseCase,

    inject: [AGENT_SESSION_REPOSITORY, CLOCK, AgentStatusTransitionPolicy],

    useFactory: (
      repository: AgentSessionRepository,

      clock: Clock,

      policy: AgentStatusTransitionPolicy,
    ) => new ChangeAgentStatusUseCase(repository, clock, policy),
  },

  {
    provide: HeartbeatAgentSessionUseCase,

    inject: [AGENT_SESSION_REPOSITORY, CLOCK],

    useFactory: (
      repository: AgentSessionRepository,

      clock: Clock,
    ) => new HeartbeatAgentSessionUseCase(repository, clock),
  },

  {
    provide: DisconnectAgentSessionUseCase,

    inject: [AGENT_SESSION_REPOSITORY, CLOCK],

    useFactory: (
      repository: AgentSessionRepository,

      clock: Clock,
    ) => new DisconnectAgentSessionUseCase(repository, clock),
  },
];

@Module({
  imports: [DatabaseModule],

  controllers: [AgentSessionsController],

  providers: [...infrastructureProviders, ...applicationProviders],

  exports: [GetAgentSessionUseCase],
})
export class AgentsModule {}
