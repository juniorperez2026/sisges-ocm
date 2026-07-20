import { CALL_STATUS } from './call-status';
import { CallStatusTransitionPolicy } from './call-status-transition.policy';
import { CALL_PHONE_KIND, Call } from './call';

describe('Call', () => {
  const createdAt = new Date('2026-07-20T17:00:00.000Z');

  function createCall(): Call {
    return Call.start({
      id: '2d40694e-e0c3-4be2-a64e-83f5250e1c7e',

      agentSessionId: '417e43c7-cbfc-49f7-a844-bb16157107da',

      sourcePhoneId: '100',
      debtorId: '200',
      contractId: null,

      dialedE164Number: '+51999999999',

      dialedNationalNumber: '999999999',

      phoneKind: CALL_PHONE_KIND.MOBILE,

      createdAt,
    });
  }

  it('starts as CREATED', () => {
    const call = createCall();

    expect(call.status).toBe(CALL_STATUS.CREATED);

    expect(call.getPendingStatusChange()).toMatchObject({
      previousStatus: null,
      nextStatus: CALL_STATUS.CREATED,
    });
  });

  it('cancels a prepared call', () => {
    const call = createCall();

    call.markPersisted(1);

    const cancelledAt = new Date('2026-07-20T17:01:00.000Z');

    call.changeStatus(
      CALL_STATUS.CANCELLED,
      cancelledAt,
      new CallStatusTransitionPolicy(),
      'CANCELLED_BEFORE_DIALING',
    );

    expect(call.status).toBe(CALL_STATUS.CANCELLED);

    expect(call.endedAt?.toISOString()).toBe(cancelledAt.toISOString());
  });

  it('rejects an invalid direct transition to ANSWERED', () => {
    const call = createCall();

    call.markPersisted(1);

    expect(() =>
      call.changeStatus(
        CALL_STATUS.ANSWERED,
        new Date('2026-07-20T17:01:00.000Z'),
        new CallStatusTransitionPolicy(),
      ),
    ).toThrow();
  });
});
