import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import {
  LEGACY_PHONE_REPOSITORY,
  type LegacyPhoneRepository,
} from './application/ports/legacy-phone.repository';
import { GetCallablePhonesByDebtorUseCase } from './application/use-cases/get-callable-phones-by-debtor.use-case';
import { PeruPhoneNumberNormalizer } from './domain/peru-phone-number.normalizer';
import { SqlServerLegacyPhoneRepository } from './infrastructure/persistence/sql-server-legacy-phone.repository';

const phoneProviders: Provider[] = [
  {
    provide: PeruPhoneNumberNormalizer,

    inject: [ConfigService],

    useFactory: (configService: ConfigService) =>
      new PeruPhoneNumberNormalizer(
        configService.getOrThrow<string>('TELEPHONY_DEFAULT_COUNTRY_CODE'),

        configService.get<string>('TELEPHONY_DEFAULT_AREA_CODE') || null,
      ),
  },

  {
    provide: LEGACY_PHONE_REPOSITORY,

    useClass: SqlServerLegacyPhoneRepository,
  },

  {
    provide: GetCallablePhonesByDebtorUseCase,

    inject: [LEGACY_PHONE_REPOSITORY, PeruPhoneNumberNormalizer],

    useFactory: (
      repository: LegacyPhoneRepository,

      normalizer: PeruPhoneNumberNormalizer,
    ) => new GetCallablePhonesByDebtorUseCase(repository, normalizer),
  },
];

@Module({
  imports: [DatabaseModule],

  providers: [...phoneProviders],

  exports: [GetCallablePhonesByDebtorUseCase],
})
export class PhonesModule {}
