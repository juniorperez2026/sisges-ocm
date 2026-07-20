export const LEGACY_PHONE_REPOSITORY = Symbol('LEGACY_PHONE_REPOSITORY');

export interface LegacyPhoneRecord {
  readonly sourcePhoneId: string;
  readonly debtorId: string;

  /*
   * El prefijo y el número se conservan separados
   * para evitar normalizaciones incorrectas.
   */
  readonly phonePrefix: string | null;
  readonly phoneNumber: string;

  readonly isActive: boolean;
  readonly isCallable: boolean;

  readonly countryCode: string;
  readonly phoneType: string | null;

  readonly isPreferred: boolean;
  readonly priority: number | null;

  readonly contractId: string | null;
  readonly updatedAt: Date | null;
}

export interface LegacyPhoneRepository {
  findCallableByDebtorId(
    debtorId: number,
  ): Promise<readonly LegacyPhoneRecord[]>;
}
