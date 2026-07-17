import { Module, type Provider } from '@nestjs/common';
import { CLOCK, type Clock } from '../../shared/application/clock';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/id-generator';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { UuidIdGenerator } from '../../shared/infrastructure/uuid-id-generator';
import {
  AGENT_SESSION_REPOSITORY,
  type AgentSessionRepository,
} from './application/ports/agent-session.repository';
import { ChangeAgentStatusUseCase } from './application/use-cases/change-agent-status.use-case';
import { GetAgentSessionUseCase } from './application/use-cases/get-agent-session.use-case';
import { StartAgentSessionUseCase } from './application/use-cases/start-agent-session.use-case';
import { AgentStatusTransitionPolicy } from './domain/agent-status-transition.policy';
import { InMemoryAgentSessionRepository } from './infrastructure/persistence/in-memory-agent-session.repository';
import { AgentSessionsController } from './presentation/http/agent-sessions.controller';

const infrastructureProviders: Provider[] = [
  {
    provide: AGENT_SESSION_REPOSITORY,
    useClass: InMemoryAgentSessionRepository,
  },
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
];

@Module({
  controllers: [AgentSessionsController],
  providers: [...infrastructureProviders, ...applicationProviders],
})
export class AgentsModule {}
