import { PeruPhoneNumberNormalizer } from '../../domain/peru-phone-number.normalizer';
import type {
  LegacyPhoneRecord,
  LegacyPhoneRepository,
} from '../ports/legacy-phone.repository';
import { GetCallablePhonesByDebtorUseCase } from './get-callable-phones-by-debtor.use-case';

class FakeLegacyPhoneRepository implements LegacyPhoneRepository {
  constructor(private readonly records: readonly LegacyPhoneRecord[]) {}

  findCallableByDebtorId(): Promise<readonly LegacyPhoneRecord[]> {
    return Promise.resolve(this.records);
  }
}

describe('GetCallablePhonesByDebtorUseCase', () => {
  it('normalizes, orders and deduplicates callable phones', async () => {
    const records: LegacyPhoneRecord[] = [
      {
        sourcePhoneId: '1',
        debtorId: '100',
        phonePrefix: null,
        phoneNumber: '999999999',
        isActive: true,
        isCallable: true,
        countryCode: '51',
        phoneType: null,
        isPreferred: true,
        priority: 1,
        contractId: null,
        updatedAt: null,
      },
      {
        sourcePhoneId: '2',
        debtorId: '100',
        phonePrefix: '01',
        phoneNumber: '2345678',
        isActive: true,
        isCallable: true,
        countryCode: '51',
        phoneType: '2',
        isPreferred: false,
        priority: 2,
        contractId: null,
        updatedAt: null,
      },
      {
        sourcePhoneId: '3',
        debtorId: '100',
        phonePrefix: null,
        phoneNumber: '999999999',
        isActive: true,
        isCallable: true,
        countryCode: '51',
        phoneType: null,
        isPreferred: false,
        priority: 3,
        contractId: null,
        updatedAt: null,
      },
      {
        sourcePhoneId: '4',
        debtorId: '100',
        phonePrefix: null,
        phoneNumber: '12345',
        isActive: true,
        isCallable: true,
        countryCode: '51',
        phoneType: null,
        isPreferred: false,
        priority: 4,
        contractId: null,
        updatedAt: null,
      },
      {
        sourcePhoneId: '5',
        debtorId: '100',
        phonePrefix: null,
        phoneNumber: '988888888',
        isActive: false,
        isCallable: false,
        countryCode: '51',
        phoneType: null,
        isPreferred: false,
        priority: 5,
        contractId: null,
        updatedAt: null,
      },
    ];

    const useCase = new GetCallablePhonesByDebtorUseCase(
      new FakeLegacyPhoneRepository(records),

      new PeruPhoneNumberNormalizer('51', '1'),
    );

    const result = await useCase.execute(100);

    expect(result.phones).toHaveLength(2);

    expect(result.phones.map((phone) => phone.e164Number)).toEqual([
      '+51999999999',
      '+5112345678',
    ]);

    expect(result.duplicateCount).toBe(1);

    expect(result.discardedCount).toBe(2);
  });
});
