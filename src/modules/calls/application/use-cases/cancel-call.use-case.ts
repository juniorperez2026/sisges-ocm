import type { Clock } from '../../../../shared/application/clock';
import { createCallNotFoundError } from '../errors/call.errors';
import type { CallRepository } from '../ports/call.repository';
import { toCallView, type CallView } from '../views/call.view';
import { CALL_STATUS } from '../../domain/call-status';
import { CallStatusTransitionPolicy } from '../../domain/call-status-transition.policy';

export class CancelCallUseCase {
  constructor(
    private readonly repository: CallRepository,

    private readonly clock: Clock,

    private readonly policy: CallStatusTransitionPolicy,
  ) {}

  async execute(callId: string): Promise<CallView> {
    const call = await this.repository.findById(callId);

    if (!call) {
      throw createCallNotFoundError(callId);
    }

    call.changeStatus(
      CALL_STATUS.CANCELLED,
      this.clock.now(),
      this.policy,
      'CANCELLED_BEFORE_DIALING',
    );

    await this.repository.save(call);

    return toCallView(call);
  }
}
