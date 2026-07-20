import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GetCallablePhonesByDebtorUseCase } from '../src/modules/phones/application/use-cases/get-callable-phones-by-debtor.use-case';

function maskPhoneNumber(
  e164Number: string,
): string {
  const visibleDigits = 3;

  if (
    e164Number.length <=
    visibleDigits
  ) {
    return '*'.repeat(
      e164Number.length,
    );
  }

  const ending =
    e164Number.slice(
      -visibleDigits,
    );

  const hiddenLength =
    e164Number.length -
    visibleDigits -
    3;

  return [
    e164Number.slice(0, 3),
    '*'.repeat(
      Math.max(hiddenLength, 3),
    ),
    ending,
  ].join('');
}

async function main(): Promise<void> {
  const rawDebtorId =
    process.argv[2];

  const debtorId =
    Number(rawDebtorId);

  if (
    !Number.isInteger(debtorId) ||
    debtorId <= 0
  ) {
    throw new Error(
      'Usage: npm run db:preview-phones -- <debtorId>',
    );
  }

  const application =
    await NestFactory
      .createApplicationContext(
        AppModule,
        {
          logger: [
            'error',
            'warn',
          ],
        },
      );

  try {
    const useCase =
      application.get(
        GetCallablePhonesByDebtorUseCase,
      );

    const result =
      await useCase.execute(
        debtorId,
      );

    console.log(
      JSON.stringify(
        {
          queried: true,
          debtorId:
            result.debtorId,

          validCount:
            result.phones.length,

          discardedCount:
            result.discardedCount,

          duplicateCount:
            result.duplicateCount,

          phones:
            result.phones.map(
              (phone) => ({
                sourcePhoneId:
                  phone.sourcePhoneId,

                phoneNumber:
                  maskPhoneNumber(
                    phone.e164Number,
                  ),

                kind:
                  phone.kind,

                phoneType:
                  phone.phoneType,

                isPreferred:
                  phone.isPreferred,

                priority:
                  phone.priority,

                updatedAt:
                  phone.updatedAt,
              }),
            ),
        },
        null,
        2,
      ),
    );
  } finally {
    await application.close();
  }
}

void main().catch(
  (error: unknown) => {
    console.error(
      JSON.stringify(
        {
          queried: false,

          message:
            error instanceof Error
              ? error.message
              : String(error),
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  },
);
