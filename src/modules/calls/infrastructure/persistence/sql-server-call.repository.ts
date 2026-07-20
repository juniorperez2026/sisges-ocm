import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ApplicationError } from '../../../../shared/application/application.error';
import { SqlServerConnectionService } from '../../../../shared/infrastructure/database/sql-server/sql-server-connection.service';
import {
  createActiveCallExistsError,
  createCallConcurrencyError,
  createCallNotFoundError,
} from '../../application/errors/call.errors';
import type { CallRepository } from '../../application/ports/call.repository';
import { Call, type CallPhoneKind, type CallSnapshot } from '../../domain/call';
import type { CallStatus } from '../../domain/call-status';

interface CallRow {
  id: string;
  agentSessionId: string;

  sourcePhoneId: string;
  debtorId: string;
  contractId: string | null;

  dialedE164Number: string;
  dialedNationalNumber: string;
  phoneKind: string;

  status: string;

  asteriskChannelId: string | null;
  asteriskBridgeId: string | null;

  createdAt: Date;
  lastStatusChangedAt: Date;

  dialingAt: Date | null;
  ringingAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;

  terminationReason: string | null;

  version: number | string;
}

interface VersionRow {
  version: number | string;
}

interface ExistenceRow {
  callExists: boolean | number;
}

@Injectable()
export class SqlServerCallRepository implements CallRepository {
  constructor(private readonly sqlServer: SqlServerConnectionService) {}

  async findById(callId: string): Promise<Call | null> {
    const pool = await this.sqlServer.getPool();

    const result = await pool
      .request()
      .input('callId', sql.UniqueIdentifier, callId).query<CallRow>(`
        SELECT
          LOWER(
            CONVERT(
              varchar(36),
              callObject.[id]
            )
          ) AS id,

          LOWER(
            CONVERT(
              varchar(36),
              callObject.[sesion_agente_id]
            )
          ) AS agentSessionId,

          callObject.[telefono_origen_id]
            AS sourcePhoneId,

          callObject.[deudor_origen_id]
            AS debtorId,

          callObject.[contrato_origen_id]
            AS contractId,

          callObject.[numero_marcado_e164]
            AS dialedE164Number,

          callObject.[numero_marcado_nacional]
            AS dialedNationalNumber,

          callObject.[tipo_numero]
            AS phoneKind,

          callObject.[estado]
            AS status,

          callObject.[asterisk_channel_id]
            AS asteriskChannelId,

          callObject.[asterisk_bridge_id]
            AS asteriskBridgeId,

          callObject.[creado_en]
            AS createdAt,

          callObject.[ultimo_cambio_estado_en]
            AS lastStatusChangedAt,

          callObject.[marcando_en]
            AS dialingAt,

          callObject.[timbrando_en]
            AS ringingAt,

          callObject.[respondido_en]
            AS answeredAt,

          callObject.[finalizado_en]
            AS endedAt,

          callObject.[motivo_finalizacion]
            AS terminationReason,

          callObject.[version]

        FROM [telefonia].[llamadas]
          AS callObject

        WHERE callObject.[id] =
          @callId;
      `);

    return this.mapRow(result.recordset[0]);
  }

  async findActiveByAgentSessionId(
    agentSessionId: string,
  ): Promise<Call | null> {
    const pool = await this.sqlServer.getPool();

    const result = await pool
      .request()
      .input('agentSessionId', sql.UniqueIdentifier, agentSessionId)
      .query<CallRow>(`
        SELECT TOP (1)
          LOWER(
            CONVERT(
              varchar(36),
              callObject.[id]
            )
          ) AS id,

          LOWER(
            CONVERT(
              varchar(36),
              callObject.[sesion_agente_id]
            )
          ) AS agentSessionId,

          callObject.[telefono_origen_id]
            AS sourcePhoneId,

          callObject.[deudor_origen_id]
            AS debtorId,

          callObject.[contrato_origen_id]
            AS contractId,

          callObject.[numero_marcado_e164]
            AS dialedE164Number,

          callObject.[numero_marcado_nacional]
            AS dialedNationalNumber,

          callObject.[tipo_numero]
            AS phoneKind,

          callObject.[estado]
            AS status,

          callObject.[asterisk_channel_id]
            AS asteriskChannelId,

          callObject.[asterisk_bridge_id]
            AS asteriskBridgeId,

          callObject.[creado_en]
            AS createdAt,

          callObject.[ultimo_cambio_estado_en]
            AS lastStatusChangedAt,

          callObject.[marcando_en]
            AS dialingAt,

          callObject.[timbrando_en]
            AS ringingAt,

          callObject.[respondido_en]
            AS answeredAt,

          callObject.[finalizado_en]
            AS endedAt,

          callObject.[motivo_finalizacion]
            AS terminationReason,

          callObject.[version]

        FROM [telefonia].[llamadas]
          AS callObject

        WHERE
          callObject.[sesion_agente_id] =
            @agentSessionId

          AND callObject.[finalizado_en]
            IS NULL

        ORDER BY
          callObject.[creado_en] DESC;
      `);

    return this.mapRow(result.recordset[0]);
  }

  async save(call: Call): Promise<void> {
    if (call.version === 0) {
      await this.insert(call);
      return;
    }

    await this.update(call);
  }

  private async insert(call: Call): Promise<void> {
    const statusChange = call.getPendingStatusChange();

    if (!statusChange) {
      throw new Error('New call does not contain its creation event');
    }

    const pool = await this.sqlServer.getPool();

    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const result = await new sql.Request(transaction)
        .input('callId', sql.UniqueIdentifier, call.id)
        .input('agentSessionId', sql.UniqueIdentifier, call.agentSessionId)
        .input('sourcePhoneId', sql.NVarChar(100), call.sourcePhoneId)
        .input('debtorId', sql.NVarChar(100), call.debtorId)
        .input('contractId', sql.NVarChar(100), call.contractId)
        .input('e164Number', sql.VarChar(20), call.dialedE164Number)
        .input('nationalNumber', sql.VarChar(20), call.dialedNationalNumber)
        .input('phoneKind', sql.VarChar(10), call.phoneKind)
        .input('status', sql.VarChar(20), call.status)
        .input('createdAt', sql.DateTime2(3), call.createdAt)
        .query<VersionRow>(`
            INSERT INTO
              [telefonia].[llamadas] (
                [id],
                [sesion_agente_id],
                [telefono_origen_id],
                [deudor_origen_id],
                [contrato_origen_id],
                [numero_marcado_e164],
                [numero_marcado_nacional],
                [tipo_numero],
                [estado],
                [creado_en],
                [ultimo_cambio_estado_en],
                [version]
              )

            OUTPUT
              INSERTED.[version]
                AS version

            VALUES (
              @callId,
              @agentSessionId,
              @sourcePhoneId,
              @debtorId,
              @contractId,
              @e164Number,
              @nationalNumber,
              @phoneKind,
              @status,
              @createdAt,
              @createdAt,
              1
            );
          `);

      const persistedVersion = this.toVersion(result.recordset[0]?.version);

      await new sql.Request(transaction)
        .input('callId', sql.UniqueIdentifier, call.id)
        .input('sequence', sql.BigInt, persistedVersion)
        .input('newStatus', sql.VarChar(20), statusChange.nextStatus)
        .input('occurredAt', sql.DateTime2(3), statusChange.changedAt).query(`
          INSERT INTO
            [telefonia].[eventos_llamada] (
              [llamada_id],
              [secuencia],
              [tipo_evento],
              [estado_anterior],
              [estado_nuevo],
              [ocurrido_en]
            )

          VALUES (
            @callId,
            @sequence,
            'CALL_CREATED',
            NULL,
            @newStatus,
            @occurredAt
          );
        `);

      await transaction.commit();

      call.markPersisted(persistedVersion);
    } catch (error: unknown) {
      try {
        await transaction.rollback();
      } catch {
        // Preserve original error.
      }

      if (error instanceof ApplicationError) {
        throw error;
      }

      if (this.isUniqueViolation(error)) {
        throw createActiveCallExistsError(call.agentSessionId);
      }

      throw error;
    }
  }

  private async update(call: Call): Promise<void> {
    const statusChange = call.getPendingStatusChange();

    if (!statusChange) {
      throw new Error('Call does not contain a pending status change');
    }

    const pool = await this.sqlServer.getPool();

    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const result = await new sql.Request(transaction)
        .input('callId', sql.UniqueIdentifier, call.id)
        .input('expectedVersion', sql.BigInt, call.version)
        .input('status', sql.VarChar(20), call.status)
        .input(
          'lastStatusChangedAt',
          sql.DateTime2(3),
          call.lastStatusChangedAt,
        )
        .input('dialingAt', sql.DateTime2(3), call.dialingAt)
        .input('ringingAt', sql.DateTime2(3), call.ringingAt)
        .input('answeredAt', sql.DateTime2(3), call.answeredAt)
        .input('endedAt', sql.DateTime2(3), call.endedAt)
        .input('terminationReason', sql.VarChar(100), call.terminationReason)
        .query<VersionRow>(`
            UPDATE
              [telefonia].[llamadas]

            SET
              [estado] =
                @status,

              [ultimo_cambio_estado_en] =
                @lastStatusChangedAt,

              [marcando_en] =
                @dialingAt,

              [timbrando_en] =
                @ringingAt,

              [respondido_en] =
                @answeredAt,

              [finalizado_en] =
                @endedAt,

              [motivo_finalizacion] =
                @terminationReason,

              [version] =
                [version] + 1,

              [actualizado_en] =
                SYSUTCDATETIME()

            OUTPUT
              INSERTED.[version]
                AS version

            WHERE
              [id] = @callId

              AND [version] =
                @expectedVersion;
          `);

      const updatedVersion = result.recordset[0]?.version;

      if (updatedVersion === undefined) {
        const existence = await new sql.Request(transaction).input(
          'callId',
          sql.UniqueIdentifier,
          call.id,
        ).query<ExistenceRow>(`
              SELECT
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM
                      [telefonia].[llamadas]
                    WHERE [id] =
                      @callId
                  )
                    THEN 1
                  ELSE 0
                END AS callExists;
            `);

        const callExists = this.toBoolean(existence.recordset[0]?.callExists);

        await transaction.rollback();

        if (!callExists) {
          throw createCallNotFoundError(call.id);
        }

        throw createCallConcurrencyError(call.id);
      }

      const persistedVersion = this.toVersion(updatedVersion);

      await new sql.Request(transaction)
        .input('callId', sql.UniqueIdentifier, call.id)
        .input('sequence', sql.BigInt, persistedVersion)
        .input('previousStatus', sql.VarChar(20), statusChange.previousStatus)
        .input('newStatus', sql.VarChar(20), statusChange.nextStatus)
        .input('occurredAt', sql.DateTime2(3), statusChange.changedAt).query(`
          INSERT INTO
            [telefonia].[eventos_llamada] (
              [llamada_id],
              [secuencia],
              [tipo_evento],
              [estado_anterior],
              [estado_nuevo],
              [ocurrido_en]
            )

          VALUES (
            @callId,
            @sequence,
            'CALL_STATUS_CHANGED',
            @previousStatus,
            @newStatus,
            @occurredAt
          );
        `);

      await transaction.commit();

      call.markPersisted(persistedVersion);
    } catch (error: unknown) {
      try {
        await transaction.rollback();
      } catch {
        // The transaction may already be completed.
      }

      throw error;
    }
  }

  private mapRow(row: CallRow | undefined): Call | null {
    if (!row) {
      return null;
    }

    const snapshot: CallSnapshot = {
      id: String(row.id),

      agentSessionId: String(row.agentSessionId),

      sourcePhoneId: String(row.sourcePhoneId),

      debtorId: String(row.debtorId),

      contractId: row.contractId,

      dialedE164Number: row.dialedE164Number,

      dialedNationalNumber: row.dialedNationalNumber,

      phoneKind: row.phoneKind as CallPhoneKind,

      status: row.status as CallStatus,

      asteriskChannelId: row.asteriskChannelId,

      asteriskBridgeId: row.asteriskBridgeId,

      createdAt: new Date(row.createdAt),

      lastStatusChangedAt: new Date(row.lastStatusChangedAt),

      dialingAt: row.dialingAt ? new Date(row.dialingAt) : null,

      ringingAt: row.ringingAt ? new Date(row.ringingAt) : null,

      answeredAt: row.answeredAt ? new Date(row.answeredAt) : null,

      endedAt: row.endedAt ? new Date(row.endedAt) : null,

      terminationReason: row.terminationReason,

      version: this.toVersion(row.version),
    };

    return Call.rehydrate(snapshot);
  }

  private toVersion(value: number | string | undefined): number {
    const version = Number(value);

    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error('Invalid call persistence version');
    }

    return version;
  }

  private toBoolean(value: boolean | number | undefined): boolean {
    return value === true || value === 1;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const candidate = error as {
      number?: unknown;

      originalError?: {
        info?: {
          number?: unknown;
        };
      };
    };

    const errorNumber =
      candidate.number ?? candidate.originalError?.info?.number;

    return errorNumber === 2601 || errorNumber === 2627;
  }
}
