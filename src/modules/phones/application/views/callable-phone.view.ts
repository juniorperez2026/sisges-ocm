import type { PhoneNumberKind } from '../../domain/peru-phone-number.normalizer';

export interface CallablePhoneView {
  readonly sourcePhoneId: string;
  readonly debtorId: string;
  readonly contractId: string | null;

  readonly countryCode: string;
  readonly nationalNumber: string;
  readonly e164Number: string;
  readonly kind: PhoneNumberKind;

  readonly phoneType: string | null;

  readonly isPreferred: boolean;
  readonly priority: number | null;

  readonly updatedAt: string | null;
}

export interface CallablePhonesResult {
  readonly debtorId: string;

  readonly phones: readonly CallablePhoneView[];

  readonly discardedCount: number;
  readonly duplicateCount: number;
}
