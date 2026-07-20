import { PeruPhoneNumberNormalizer } from '../../domain/peru-phone-number.normalizer';
import type { LegacyPhoneRepository } from '../ports/legacy-phone.repository';
import type {
  CallablePhonesResult,
  CallablePhoneView,
} from '../views/callable-phone.view';

export class GetCallablePhonesByDebtorUseCase {
  constructor(
    private readonly repository: LegacyPhoneRepository,

    private readonly normalizer: PeruPhoneNumberNormalizer,
  ) {}

  async execute(debtorId: number): Promise<CallablePhonesResult> {
    if (!Number.isInteger(debtorId) || debtorId <= 0) {
      throw new Error('Debtor ID must be a positive integer');
    }

    const records = await this.repository.findCallableByDebtorId(debtorId);

    const phones: CallablePhoneView[] = [];

    const normalizedNumbers = new Set<string>();

    let discardedCount = 0;
    let duplicateCount = 0;

    for (const record of records) {
      if (!record.isActive || !record.isCallable) {
        discardedCount += 1;
        continue;
      }

      const normalization = this.normalizer.normalize({
        countryCode: record.countryCode,

        phonePrefix: record.phonePrefix,

        phoneNumber: record.phoneNumber,
      });

      if (!normalization.success) {
        discardedCount += 1;
        continue;
      }

      const normalized = normalization.value;

      if (normalizedNumbers.has(normalized.e164Number)) {
        duplicateCount += 1;
        continue;
      }

      normalizedNumbers.add(normalized.e164Number);

      phones.push({
        sourcePhoneId: record.sourcePhoneId,

        debtorId: record.debtorId,

        contractId: record.contractId,

        countryCode: normalized.countryCode,

        nationalNumber: normalized.nationalNumber,

        e164Number: normalized.e164Number,

        kind: normalized.kind,

        phoneType: record.phoneType,

        isPreferred: record.isPreferred,

        priority: record.priority,

        updatedAt: record.updatedAt?.toISOString() ?? null,
      });
    }

    phones.sort((left, right) => {
      if (left.isPreferred !== right.isPreferred) {
        return left.isPreferred ? -1 : 1;
      }

      const leftUpdatedAt = left.updatedAt ? Date.parse(left.updatedAt) : 0;

      const rightUpdatedAt = right.updatedAt ? Date.parse(right.updatedAt) : 0;

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt - leftUpdatedAt;
      }

      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;

      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.sourcePhoneId.localeCompare(right.sourcePhoneId);
    });

    return {
      debtorId: String(debtorId),
      phones,
      discardedCount,
      duplicateCount,
    };
  }
}
