import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { LegacySqlServerConnectionService } from '../../../../shared/infrastructure/database/sql-server/legacy-sql-server-connection.service';
import type {
  LegacyPhoneRecord,
  LegacyPhoneRepository,
} from '../../application/ports/legacy-phone.repository';

interface LegacyPhoneRow {
  sourcePhoneId: string;
  debtorId: string;

  phonePrefix: string | null;
  phoneNumber: string;

  isActive: boolean | number;
  isCallable: boolean | number;

  countryCode: string;
  phoneType: string | null;

  isPreferred: boolean | number;
  priority: number | null;

  contractId: string | null;
  updatedAt: Date | null;
}

@Injectable()
export class SqlServerLegacyPhoneRepository implements LegacyPhoneRepository {
  constructor(
    private readonly sqlServer: LegacySqlServerConnectionService,

    private readonly configService: ConfigService,
  ) {}

  async findCallableByDebtorId(
    debtorId: number,
  ): Promise<readonly LegacyPhoneRecord[]> {
    const pool = await this.sqlServer.getPool();

    const queryLimit = this.configService.getOrThrow<number>(
      'LEGACY_PHONE_QUERY_LIMIT',
    );

    const result = await pool
      .request()
      .input('debtorId', sql.Int, debtorId)
      .input('queryLimit', sql.Int, queryLimit).query<LegacyPhoneRow>(`
        SELECT TOP (@queryLimit)
          CONVERT(
            varchar(30),
            pt.nId_PersTelef
          ) AS sourcePhoneId,

          CONVERT(
            varchar(30),
            pt.nId_PersDeudor
          ) AS debtorId,

          NULLIF(
            LTRIM(
              RTRIM(
                CONVERT(
                  varchar(20),
                  pt.nTelef_Pre
                )
              )
            ),
            ''
          ) AS phonePrefix,

          NULLIF(
            LTRIM(
              RTRIM(
                CONVERT(
                  varchar(30),
                  pt.nTelef_Nro
                )
              )
            ),
            ''
          ) AS phoneNumber,

          CONVERT(
            bit,
            ISNULL(
              pt.bEstado,
              1
            )
          ) AS isActive,

          CONVERT(
            bit,
            CASE
              WHEN ISNULL(
                pt.bEstado,
                1
              ) = 1
                THEN 1
              ELSE 0
            END
          ) AS isCallable,

          '51' AS countryCode,

          CASE
            WHEN pt.nId_TipoTelefono
              IS NULL
              THEN NULL
            ELSE CONVERT(
              varchar(30),
              pt.nId_TipoTelefono
            )
          END AS phoneType,

          CONVERT(
            bit,
            CASE
              WHEN TRY_CONVERT(
                int,
                pt.nTelef_Prioridad
              ) = 1
                THEN 1
              ELSE 0
            END
          ) AS isPreferred,

          CASE
            WHEN TRY_CONVERT(
              int,
              pt.nTelef_Prioridad
            ) > 0
              THEN TRY_CONVERT(
                int,
                pt.nTelef_Prioridad
              )
            ELSE NULL
          END AS priority,

          CAST(
            NULL AS varchar(30)
          ) AS contractId,

          COALESCE(
            pt.dFecUlt_PerstelefOpe,
            pt.dFecCarga_PersTelef
          ) AS updatedAt

        FROM dbo.av_PersTelef AS pt

        WHERE
          pt.nId_PersDeudor =
            @debtorId

          AND ISNULL(
            pt.bEstado,
            1
          ) = 1

          AND NULLIF(
            LTRIM(
              RTRIM(
                CONVERT(
                  varchar(30),
                  pt.nTelef_Nro
                )
              )
            ),
            ''
          ) IS NOT NULL

        ORDER BY
          CASE
            WHEN TRY_CONVERT(
              int,
              pt.nTelef_Prioridad
            ) = 1
              THEN 0

            WHEN TRY_CONVERT(
              int,
              pt.nTelef_Prioridad
            ) > 1
              THEN 1

            ELSE 2
          END,

          CASE
            WHEN TRY_CONVERT(
              int,
              pt.nTelef_Prioridad
            ) > 0
              THEN TRY_CONVERT(
                int,
                pt.nTelef_Prioridad
              )

            ELSE 2147483647
          END,

          COALESCE(
            pt.dFecUlt_PerstelefOpe,
            pt.dFecCarga_PersTelef
          ) DESC,

          pt.nId_PersTelef DESC;
      `);

    return result.recordset.map((row) => ({
      sourcePhoneId: String(row.sourcePhoneId),

      debtorId: String(row.debtorId),

      phonePrefix: row.phonePrefix,

      phoneNumber: row.phoneNumber,

      isActive: this.toBoolean(row.isActive),

      isCallable: this.toBoolean(row.isCallable),

      countryCode: row.countryCode,

      phoneType: row.phoneType,

      isPreferred: this.toBoolean(row.isPreferred),

      priority: row.priority,

      contractId: row.contractId,

      updatedAt: row.updatedAt,
    }));
  }

  private toBoolean(value: boolean | number): boolean {
    return value === true || value === 1;
  }
}
