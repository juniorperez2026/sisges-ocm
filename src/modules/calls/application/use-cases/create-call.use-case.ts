import type { Clock } from '../../../../shared/application/clock';
import type { IdGenerator } from '../../../../shared/application/id-generator';
import { GetAgentSessionUseCase } from '../../../agents/application/use-cases/get-agent-session.use-case';
import { GetCallablePhonesByDebtorUseCase } from '../../../phones/application/use-cases/get-callable-phones-by-debtor.use-case';
import {
  createActiveCallExistsError,
  createAgentSessionNotAvailableError,
  createCallablePhoneNotFoundError,
} from '../errors/call.errors';
import type { CallRepository } from '../ports/call.repository';
import { toCallView, type CallView } from '../views/call.view';
import { Call } from '../../domain/call';

export interface CreateCallCommand {
  readonly agentSessionId: string;

  readonly debtorId: number;

  readonly sourcePhoneId: string;
}

export class CreateCallUseCase {
  constructor(
    private readonly callRepository: CallRepository,

    private readonly getAgentSession: GetAgentSessionUseCase,

    private readonly getCallablePhones: GetCallablePhonesByDebtorUseCase,

    private readonly idGenerator: IdGenerator,

    private readonly clock: Clock,
  ) {}

  async execute(command: CreateCallCommand): Promise<CallView> {
    const session = await this.getAgentSession.execute(command.agentSessionId);

    if (session.disconnectedAt !== null || session.status !== 'AVAILABLE') {
      throw createAgentSessionNotAvailableError(session.id, session.status);
    }

    const existingCall = await this.callRepository.findActiveByAgentSessionId(
      session.id,
    );

    if (existingCall) {
      throw createActiveCallExistsError(session.id, existingCall.id);
    }

    const phoneResult = await this.getCallablePhones.execute(command.debtorId);

    const selectedPhone = phoneResult.phones.find(
      (phone) => phone.sourcePhoneId === command.sourcePhoneId,
    );

    if (!selectedPhone) {
      throw createCallablePhoneNotFoundError(
        String(command.debtorId),
        command.sourcePhoneId,
      );
    }

    const call = Call.start({
      id: this.idGenerator.generate(),

      agentSessionId: session.id,

      sourcePhoneId: selectedPhone.sourcePhoneId,

      debtorId: selectedPhone.debtorId,

      contractId: selectedPhone.contractId,

      dialedE164Number: selectedPhone.e164Number,

      dialedNationalNumber: selectedPhone.nationalNumber,

      phoneKind: selectedPhone.kind,

      createdAt: this.clock.now(),
    });

    await this.callRepository.save(call);

    return toCallView(call);
  }
}
