import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCallPersistence1784570400000 implements MigrationInterface {
  readonly name = 'CreateCallPersistence1784570400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF SCHEMA_ID(N'telefonia') IS NULL
      BEGIN
        THROW 50002,
          'The telefonia schema must exist before running this migration.',
          1;
      END;
    `);

    await queryRunner.query(`
      CREATE TABLE [telefonia].[llamadas] (
        [id] uniqueidentifier NOT NULL,

        [sesion_agente_id]
          uniqueidentifier NOT NULL,

        [telefono_origen_id]
          nvarchar(100) NOT NULL,

        [deudor_origen_id]
          nvarchar(100) NOT NULL,

        [contrato_origen_id]
          nvarchar(100) NULL,

        [numero_marcado_e164]
          varchar(20) NOT NULL,

        [numero_marcado_nacional]
          varchar(20) NOT NULL,

        [tipo_numero]
          varchar(10) NOT NULL,

        [estado]
          varchar(20) NOT NULL,

        [asterisk_channel_id]
          nvarchar(150) NULL,

        [asterisk_bridge_id]
          nvarchar(150) NULL,

        [creado_en]
          datetime2(3) NOT NULL,

        [ultimo_cambio_estado_en]
          datetime2(3) NOT NULL,

        [marcando_en]
          datetime2(3) NULL,

        [timbrando_en]
          datetime2(3) NULL,

        [respondido_en]
          datetime2(3) NULL,

        [finalizado_en]
          datetime2(3) NULL,

        [motivo_finalizacion]
          varchar(100) NULL,

        [version]
          bigint NOT NULL
          CONSTRAINT [DF_telefonia_llamadas_version]
          DEFAULT 1,

        [actualizado_en]
          datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_llamadas_actualizado_en]
          DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_telefonia_llamadas]
          PRIMARY KEY CLUSTERED ([id]),

        CONSTRAINT [FK_telefonia_llamadas_sesion]
          FOREIGN KEY ([sesion_agente_id])
          REFERENCES
            [telefonia].[sesiones_agente] ([id]),

        CONSTRAINT [CK_telefonia_llamadas_tipo_numero]
          CHECK (
            [tipo_numero] IN (
              'MOBILE',
              'FIXED'
            )
          ),

        CONSTRAINT [CK_telefonia_llamadas_estado]
          CHECK (
            [estado] IN (
              'CREATED',
              'CONNECTING',
              'DIALING',
              'RINGING',
              'ANSWERED',
              'ENDING',
              'ENDED',
              'FAILED',
              'BUSY',
              'NO_ANSWER',
              'REJECTED',
              'CANCELLED'
            )
          ),

        CONSTRAINT [CK_telefonia_llamadas_version]
          CHECK ([version] > 0),

        CONSTRAINT [CK_telefonia_llamadas_cambio_estado]
          CHECK (
            [ultimo_cambio_estado_en] >=
              [creado_en]
          ),

        CONSTRAINT [CK_telefonia_llamadas_marcando]
          CHECK (
            [marcando_en] IS NULL
            OR [marcando_en] >= [creado_en]
          ),

        CONSTRAINT [CK_telefonia_llamadas_timbrando]
          CHECK (
            [timbrando_en] IS NULL
            OR [timbrando_en] >= [creado_en]
          ),

        CONSTRAINT [CK_telefonia_llamadas_respuesta]
          CHECK (
            [respondido_en] IS NULL
            OR [respondido_en] >= [creado_en]
          ),

        CONSTRAINT [CK_telefonia_llamadas_finalizacion]
          CHECK (
            [finalizado_en] IS NULL
            OR [finalizado_en] >= [creado_en]
          )
      );
    `);

    /*
     * Una sesión no puede mantener dos llamadas
     * simultáneamente sin finalizar.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_llamadas_sesion_activa]
      ON [telefonia].[llamadas] (
        [sesion_agente_id]
      )
      WHERE [finalizado_en] IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX
        [IX_telefonia_llamadas_estado]
      ON [telefonia].[llamadas] (
        [estado],
        [creado_en]
      );
    `);

    await queryRunner.query(`
      CREATE INDEX
        [IX_telefonia_llamadas_deudor]
      ON [telefonia].[llamadas] (
        [deudor_origen_id],
        [creado_en]
      )
      INCLUDE (
        [telefono_origen_id],
        [estado],
        [sesion_agente_id]
      );
    `);

    await queryRunner.query(`
      CREATE TABLE
        [telefonia].[eventos_llamada] (
          [id]
            bigint IDENTITY(1, 1) NOT NULL,

          [llamada_id]
            uniqueidentifier NOT NULL,

          [secuencia]
            bigint NOT NULL,

          [tipo_evento]
            varchar(50) NOT NULL,

          [estado_anterior]
            varchar(20) NULL,

          [estado_nuevo]
            varchar(20) NOT NULL,

          [asterisk_event_id]
            nvarchar(150) NULL,

          [payload]
            nvarchar(max) NULL,

          [ocurrido_en]
            datetime2(3) NOT NULL,

          [registrado_en]
            datetime2(3) NOT NULL
            CONSTRAINT
              [DF_telefonia_eventos_registrado_en]
            DEFAULT SYSUTCDATETIME(),

          CONSTRAINT
            [PK_telefonia_eventos_llamada]
            PRIMARY KEY CLUSTERED ([id]),

          CONSTRAINT
            [FK_telefonia_eventos_llamada]
            FOREIGN KEY ([llamada_id])
            REFERENCES
              [telefonia].[llamadas] ([id]),

          CONSTRAINT
            [CK_telefonia_eventos_secuencia]
            CHECK ([secuencia] > 0),

          CONSTRAINT
            [CK_telefonia_eventos_payload_json]
            CHECK (
              [payload] IS NULL
              OR ISJSON([payload]) = 1
            )
        );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_eventos_secuencia]
      ON [telefonia].[eventos_llamada] (
        [llamada_id],
        [secuencia]
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_eventos_asterisk]
      ON [telefonia].[eventos_llamada] (
        [asterisk_event_id]
      )
      WHERE [asterisk_event_id] IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX
        [IX_telefonia_eventos_fecha]
      ON [telefonia].[eventos_llamada] (
        [llamada_id],
        [ocurrido_en]
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE
        [telefonia].[eventos_llamada];
    `);

    await queryRunner.query(`
      DROP TABLE
        [telefonia].[llamadas];
    `);
  }
}
