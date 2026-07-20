import { NestFactory } from '@nestjs/core';
import * as sql from 'mssql';
import { AppModule } from '../src/app.module';
import { SqlServerConnectionService } from '../src/shared/infrastructure/database/sql-server/sql-server-connection.service';

function requireExtensionNumber(
  value: string | undefined,
): string {
  const extensionNumber =
    value?.trim() ?? '';

  if (
    !/^\d{2,20}$/.test(
      extensionNumber,
    )
  ) {
    throw new Error(
      'Extension number must contain between 2 and 20 digits',
    );
  }

  return extensionNumber;
}

function requireEndpoint(
  value: string | undefined,
): string {
  const endpoint =
    value?.trim() ?? '';

  if (
    !endpoint ||
    endpoint.length > 100
  ) {
    throw new Error(
      'Asterisk endpoint must contain between 1 and 100 characters',
    );
  }

  return endpoint;
}

async function main():
  Promise<void> {
  const extensionNumber =
    requireExtensionNumber(
      process.argv[2],
    );

  const endpoint =
    requireEndpoint(
      process.argv[3],
    );

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
    const sqlServer =
      application.get(
        SqlServerConnectionService,
      );

    const pool =
      await sqlServer.getPool();

    const expectedDatabase =
      process.env
        .SQL_SERVER_DATABASE;

    const connectionCheck =
      await pool.request().query<{
        databaseName: string;
      }>(`
        SELECT
          DB_NAME() AS databaseName;
      `);

    const connectedDatabase =
      connectionCheck.recordset[0]
        ?.databaseName;

    if (
      !expectedDatabase ||
      connectedDatabase !==
        expectedDatabase
    ) {
      throw new Error(
        [
          'Connected database does not match SQL_SERVER_DATABASE.',
          `Expected: ${expectedDatabase ?? 'undefined'}.`,
          `Connected: ${connectedDatabase ?? 'undefined'}.`,
        ].join(' '),
      );
    }

    const result = await pool
      .request()
      .input(
        'extensionNumber',
        sql.VarChar(20),
        extensionNumber,
      )
      .input(
        'endpoint',
        sql.NVarChar(100),
        endpoint,
      )
      .query<{
        id: string;
        extensionNumber: string;
        endpoint: string;
        status: string;
      }>(`
        IF EXISTS (
          SELECT 1
          FROM
            [telefonia].[extensiones]
          WHERE [numero_extension] =
            @extensionNumber
        )
        BEGIN
          UPDATE
            [telefonia].[extensiones]

          SET
            [endpoint_asterisk] =
              @endpoint,

            [estado] =
              'ACTIVE',

            [actualizado_en] =
              SYSUTCDATETIME()

          WHERE
            [numero_extension] =
              @extensionNumber;
        END
        ELSE
        BEGIN
          INSERT INTO
            [telefonia].[extensiones] (
              [numero_extension],
              [endpoint_asterisk],
              [estado]
            )

          VALUES (
            @extensionNumber,
            @endpoint,
            'ACTIVE'
          );
        END;

        SELECT
          CONVERT(
            varchar(36),
            [id]
          ) AS id,

          [numero_extension]
            AS extensionNumber,

          [endpoint_asterisk]
            AS endpoint,

          [estado]
            AS status

        FROM
          [telefonia].[extensiones]

        WHERE
          [numero_extension] =
            @extensionNumber;
      `);

    console.log(
      JSON.stringify(
        {
          registered: true,
          database:
            connectedDatabase,
          extension:
            result.recordset[0],
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
          registered: false,

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
