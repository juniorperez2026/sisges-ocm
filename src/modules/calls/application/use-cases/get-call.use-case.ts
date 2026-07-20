import { createCallNotFoundError } from '../errors/call.errors';
import type { CallRepository } from '../ports/call.repository';
import { toCallView, type CallView } from '../views/call.view';

export class GetCallUseCase {
  constructor(private readonly repository: CallRepository) {}

  async execute(callId: string): Promise<CallView> {
    const call = await this.repository.findById(callId);

    if (!call) {
      throw createCallNotFoundError(callId);
    }

    return toCallView(call);
  }
}
