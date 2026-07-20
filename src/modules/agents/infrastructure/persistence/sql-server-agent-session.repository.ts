import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ApplicationError } from '../../../../shared/application/application.error';
import { SqlServerConnectionService } from '../../../../shared/infrastructure/database/sql-server/sql-server-connection.service';
import { createAgentSessionConcurrencyError } from '../../application/errors/agent-session-concurrency.error';
import { createAgentSessionNotFoundError } from '../../application/errors/agent-session-not-found.error';
import { createAgentSessionPersistenceConflictError } from '../../application/errors/agent-session-persistence-conflict.error';
import { createExtensionNotFoundError } from '../../application/errors/extension-not-found.error';
import type { AgentSessionRepository } from '../../application/ports/agent-session.repository';
import {
  AgentSession,
  type AgentSessionSnapshot,
} from '../../domain/agent-session';
import type { AgentStatus } from '../../domain/agent-status';

interface AgentSessionRow {
  id: string;
  agentId: string;
  extensionId: string;
  status: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  lastStatusChangedAt: Date;
  lastHeartbeatAt: Date;
  version: number | string;
}

interface IdentifierRow {
  id: string;
}

interface VersionRow {
  version: number | string;
}

interface ExistenceRow {
  sessionExists: boolean | number;
}

@Injectable()
export class SqlServerAgentSessionRepository implements AgentSessionRepository {
  constructor(private readonly sqlServer: SqlServerConnectionService) {}

  async findById(sessionId: string): Promise<AgentSession | null> {
    const pool = await this.sqlServer.getPool();

    const result = await pool
      .request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query<AgentSessionRow>(`
        SELECT
          CONVERT(
            varchar(36),
            sessionObject.id
          ) AS id,

          agentObject.usuario_origen_id
            AS agentId,

          extensionObject.numero_extension
            AS extensionId,

          sessionObject.estado
            AS status,

          sessionObject.conectado_en
            AS connectedAt,

          sessionObject.desconectado_en
            AS disconnectedAt,

          sessionObject
            .ultimo_cambio_estado_en
            AS lastStatusChangedAt,

          sessionObject
            .ultimo_heartbeat_en
            AS lastHeartbeatAt,

          sessionObject.version

        FROM [telefonia].[sesiones_agente]
          AS sessionObject

        INNER JOIN [telefonia].[agentes]
          AS agentObject
          ON agentObject.id =
            sessionObject.agente_id

        INNER JOIN [telefonia].[extensiones]
          AS extensionObject
          ON extensionObject.id =
            sessionObject.extension_id

        WHERE sessionObject.id =
          @sessionId;
      `);

    return this.mapRow(result.recordset[0]);
  }

  async findActiveByAgentId(agentId: string): Promise<AgentSession | null> {
    const pool = await this.sqlServer.getPool();

    const result = await pool
      .request()
      .input('agentId', sql.NVarChar(100), agentId).query<AgentSessionRow>(`
        SELECT TOP (1)
          CONVERT(
            varchar(36),
            sessionObject.id
          ) AS id,

          agentObject.usuario_origen_id
            AS agentId,

          extensionObject.numero_extension
            AS extensionId,

          sessionObject.estado
            AS status,

          sessionObject.conectado_en
            AS connectedAt,

          sessionObject.desconectado_en
            AS disconnectedAt,

          sessionObject
            .ultimo_cambio_estado_en
            AS lastStatusChangedAt,

          sessionObject
            .ultimo_heartbeat_en
            AS lastHeartbeatAt,

          sessionObject.version

        FROM [telefonia].[sesiones_agente]
          AS sessionObject

        INNER JOIN [telefonia].[agentes]
          AS agentObject
          ON agentObject.id =
            sessionObject.agente_id

        INNER JOIN [telefonia].[extensiones]
          AS extensionObject
          ON extensionObject.id =
            sessionObject.extension_id

        WHERE
          agentObject.usuario_origen_id =
            @agentId

          AND sessionObject
            .desconectado_en IS NULL

        ORDER BY
          sessionObject.conectado_en DESC;
      `);

    return this.mapRow(result.recordset[0]);
  }

  async save(session: AgentSession): Promise<void> {
    if (session.version === 0) {
      await this.insert(session);
      return;
    }

    await this.update(session);
  }

  private async insert(session: AgentSession): Promise<void> {
    const pool = await this.sqlServer.getPool();

    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const agentDatabaseId = await this.resolveAgentId(
        transaction,
        session.agentId,
      );

      const extensionDatabaseId = await this.resolveExtensionId(
        transaction,
        session.extensionId,
      );

      const result = await new sql.Request(transaction)
        .input('sessionId', sql.UniqueIdentifier, session.id)
        .input('agentDatabaseId', sql.UniqueIdentifier, agentDatabaseId)
        .input('extensionDatabaseId', sql.UniqueIdentifier, extensionDatabaseId)
        .input('status', sql.VarChar(20), session.status)
        .input('connectedAt', sql.DateTime2(3), session.connectedAt)
        .input('disconnectedAt', sql.DateTime2(3), session.disconnectedAt)
        .input(
          'lastStatusChangedAt',
          sql.DateTime2(3),
          session.lastStatusChangedAt,
        )
        .input('lastHeartbeatAt', sql.DateTime2(3), session.lastHeartbeatAt)
        .query<VersionRow>(`
            INSERT INTO
              [telefonia].[sesiones_agente] (
                [id],
                [agente_id],
                [extension_id],
                [estado],
                [conectado_en],
                [desconectado_en],
                [ultimo_cambio_estado_en],
                [ultimo_heartbeat_en],
                [version]
              )

            OUTPUT
              INSERTED.[version]
                AS version

            VALUES (
              @sessionId,
              @agentDatabaseId,
              @extensionDatabaseId,
              @status,
              @connectedAt,
              @disconnectedAt,
              @lastStatusChangedAt,
              @lastHeartbeatAt,
              1
            );
          `);

      await transaction.commit();

      session.markPersisted(this.toVersion(result.recordset[0]?.version));
    } catch (error: unknown) {
      try {
        await transaction.rollback();
      } catch {
        // Preserve the original error.
      }

      if (error instanceof ApplicationError) {
        throw error;
      }

      if (this.isUniqueViolation(error)) {
        throw createAgentSessionPersistenceConflictError(
          session.agentId,
          session.extensionId,
        );
      }

      throw error;
    }
  }

  private async update(session: AgentSession): Promise<void> {
    const pool = await this.sqlServer.getPool();

    const result = await pool
      .request()
      .input('sessionId', sql.UniqueIdentifier, session.id)
      .input('expectedVersion', sql.BigInt, session.version)
      .input('status', sql.VarChar(20), session.status)
      .input('disconnectedAt', sql.DateTime2(3), session.disconnectedAt)
      .input(
        'lastStatusChangedAt',
        sql.DateTime2(3),
        session.lastStatusChangedAt,
      )
      .input('lastHeartbeatAt', sql.DateTime2(3), session.lastHeartbeatAt)
      .query<VersionRow>(`
        UPDATE
          [telefonia].[sesiones_agente]

        SET
          [estado] = @status,

          [desconectado_en] =
            @disconnectedAt,

          [ultimo_cambio_estado_en] =
            @lastStatusChangedAt,

          [ultimo_heartbeat_en] =
            @lastHeartbeatAt,

          [version] =
            [version] + 1,

          [actualizado_en] =
            SYSUTCDATETIME()

        OUTPUT
          INSERTED.[version]
            AS version

        WHERE
          [id] = @sessionId

          AND [version] =
            @expectedVersion;
      `);

    const updatedVersion = result.recordset[0]?.version;

    if (updatedVersion !== undefined) {
      session.markPersisted(this.toVersion(updatedVersion));

      return;
    }

    const existence = await pool
      .request()
      .input('sessionId', sql.UniqueIdentifier, session.id)
      .query<ExistenceRow>(`
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM
                  [telefonia].[sesiones_agente]
                WHERE [id] =
                  @sessionId
              )
                THEN 1
              ELSE 0
            END AS sessionExists;
        `);

    const sessionExists = this.toBoolean(existence.recordset[0]?.sessionExists);

    if (!sessionExists) {
      throw createAgentSessionNotFoundError(session.id);
    }

    throw createAgentSessionConcurrencyError(session.id);
  }

  private async resolveAgentId(
    transaction: sql.Transaction,
    agentId: string,
  ): Promise<string> {
    const result = await new sql.Request(transaction).input(
      'agentId',
      sql.NVarChar(100),
      agentId,
    ).query<IdentifierRow>(`
          DECLARE @ResolvedAgent
            TABLE (
              [id] uniqueidentifier
                NOT NULL
            );

          INSERT INTO @ResolvedAgent (
            [id]
          )
          SELECT TOP (1)
            [id]
          FROM [telefonia].[agentes]
            WITH (
              UPDLOCK,
              HOLDLOCK
            )
          WHERE [usuario_origen_id] =
            @agentId;

          IF NOT EXISTS (
            SELECT 1
            FROM @ResolvedAgent
          )
          BEGIN
            INSERT INTO
              [telefonia].[agentes] (
                [usuario_origen_id],
                [estado]
              )

            OUTPUT
              INSERTED.[id]
            INTO @ResolvedAgent (
              [id]
            )

            VALUES (
              @agentId,
              'ACTIVE'
            );
          END;

          SELECT TOP (1)
            CONVERT(
              varchar(36),
              [id]
            ) AS id
          FROM @ResolvedAgent;
        `);

    const resolvedId = result.recordset[0]?.id;

    if (!resolvedId) {
      throw new Error('Could not resolve agent database ID');
    }

    return resolvedId;
  }

  private async resolveExtensionId(
    transaction: sql.Transaction,
    extensionId: string,
  ): Promise<string> {
    const result = await new sql.Request(transaction).input(
      'extensionId',
      sql.VarChar(20),
      extensionId,
    ).query<IdentifierRow>(`
          SELECT TOP (1)
            CONVERT(
              varchar(36),
              [id]
            ) AS id

          FROM [telefonia].[extensiones]
            WITH (
              UPDLOCK,
              HOLDLOCK
            )

          WHERE
            [numero_extension] =
              @extensionId

            AND [estado] = 'ACTIVE';
        `);

    const resolvedId = result.recordset[0]?.id;

    if (!resolvedId) {
      throw createExtensionNotFoundError(extensionId);
    }

    return resolvedId;
  }

  private mapRow(row: AgentSessionRow | undefined): AgentSession | null {
    if (!row) {
      return null;
    }

    const snapshot: AgentSessionSnapshot = {
      id: String(row.id),
      agentId: String(row.agentId),
      extensionId: String(row.extensionId),

      status: row.status as AgentStatus,

      connectedAt: new Date(row.connectedAt),

      disconnectedAt: row.disconnectedAt ? new Date(row.disconnectedAt) : null,

      lastStatusChangedAt: new Date(row.lastStatusChangedAt),

      lastHeartbeatAt: new Date(row.lastHeartbeatAt),

      version: this.toVersion(row.version),
    };

    return AgentSession.rehydrate(snapshot);
  }

  private toVersion(value: number | string | undefined): number {
    const version = Number(value);

    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error('Invalid agent session persistence version');
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
