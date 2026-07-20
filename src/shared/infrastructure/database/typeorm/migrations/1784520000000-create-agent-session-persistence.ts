import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentSessionPersistence1784520000000 implements MigrationInterface {
  readonly name = 'CreateAgentSessionPersistence1784520000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF SCHEMA_ID(N'telefonia') IS NULL
      BEGIN
        THROW 50001,
          'The telefonia schema must exist before running this migration.',
          1;
      END;
    `);

    await queryRunner.query(`
      CREATE TABLE [telefonia].[agentes] (
        [id] uniqueidentifier NOT NULL
          CONSTRAINT [DF_telefonia_agentes_id]
          DEFAULT NEWSEQUENTIALID(),

        [usuario_origen_id] nvarchar(100) NOT NULL,

        [estado] varchar(20) NOT NULL
          CONSTRAINT [DF_telefonia_agentes_estado]
          DEFAULT 'ACTIVE',

        [creado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_agentes_creado_en]
          DEFAULT SYSUTCDATETIME(),

        [actualizado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_agentes_actualizado_en]
          DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_telefonia_agentes]
          PRIMARY KEY CLUSTERED ([id]),

        CONSTRAINT [CK_telefonia_agentes_estado]
          CHECK (
            [estado] IN (
              'ACTIVE',
              'INACTIVE'
            )
          )
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_agentes_usuario_origen]
      ON [telefonia].[agentes] (
        [usuario_origen_id]
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [telefonia].[extensiones] (
        [id] uniqueidentifier NOT NULL
          CONSTRAINT [DF_telefonia_extensiones_id]
          DEFAULT NEWSEQUENTIALID(),

        [numero_extension] varchar(20) NOT NULL,

        [endpoint_asterisk] nvarchar(100) NOT NULL,

        [estado] varchar(20) NOT NULL
          CONSTRAINT [DF_telefonia_extensiones_estado]
          DEFAULT 'ACTIVE',

        [creado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_extensiones_creado_en]
          DEFAULT SYSUTCDATETIME(),

        [actualizado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_extensiones_actualizado_en]
          DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_telefonia_extensiones]
          PRIMARY KEY CLUSTERED ([id]),

        CONSTRAINT [CK_telefonia_extensiones_estado]
          CHECK (
            [estado] IN (
              'ACTIVE',
              'INACTIVE'
            )
          )
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_extensiones_numero]
      ON [telefonia].[extensiones] (
        [numero_extension]
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_extensiones_endpoint]
      ON [telefonia].[extensiones] (
        [endpoint_asterisk]
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [telefonia].[sesiones_agente] (
        [id] uniqueidentifier NOT NULL,

        [agente_id] uniqueidentifier NOT NULL,

        [extension_id] uniqueidentifier NOT NULL,

        [estado] varchar(20) NOT NULL,

        [conectado_en] datetime2(3) NOT NULL,

        [desconectado_en] datetime2(3) NULL,

        [ultimo_cambio_estado_en]
          datetime2(3) NOT NULL,

        [ultimo_heartbeat_en]
          datetime2(3) NOT NULL,

        [version] bigint NOT NULL
          CONSTRAINT [DF_telefonia_sesiones_version]
          DEFAULT 1,

        [creado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_sesiones_creado_en]
          DEFAULT SYSUTCDATETIME(),

        [actualizado_en] datetime2(3) NOT NULL
          CONSTRAINT [DF_telefonia_sesiones_actualizado_en]
          DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_telefonia_sesiones_agente]
          PRIMARY KEY CLUSTERED ([id]),

        CONSTRAINT [FK_telefonia_sesiones_agente]
          FOREIGN KEY ([agente_id])
          REFERENCES [telefonia].[agentes] ([id]),

        CONSTRAINT [FK_telefonia_sesiones_extension]
          FOREIGN KEY ([extension_id])
          REFERENCES [telefonia].[extensiones] ([id]),

        CONSTRAINT [CK_telefonia_sesiones_estado]
          CHECK (
            [estado] IN (
              'OFFLINE',
              'AVAILABLE',
              'DIALING',
              'ON_CALL',
              'WRAP_UP',
              'PAUSED',
              'ERROR'
            )
          ),

        CONSTRAINT [CK_telefonia_sesiones_desconexion]
          CHECK (
            [desconectado_en] IS NULL
            OR [desconectado_en] >= [conectado_en]
          ),

        CONSTRAINT [CK_telefonia_sesiones_heartbeat]
          CHECK (
            [ultimo_heartbeat_en] >= [conectado_en]
          ),

        CONSTRAINT [CK_telefonia_sesiones_cambio_estado]
          CHECK (
            [ultimo_cambio_estado_en] >= [conectado_en]
          ),

        CONSTRAINT [CK_telefonia_sesiones_version]
          CHECK ([version] > 0)
      );
    `);

    /*
     * Un agente solamente puede tener
     * una sesión activa.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_sesiones_agente_activa]
      ON [telefonia].[sesiones_agente] (
        [agente_id]
      )
      WHERE [desconectado_en] IS NULL;
    `);

    /*
     * Una extensión tampoco puede estar
     * asignada simultáneamente a dos sesiones.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX
        [UX_telefonia_sesiones_extension_activa]
      ON [telefonia].[sesiones_agente] (
        [extension_id]
      )
      WHERE [desconectado_en] IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX
        [IX_telefonia_sesiones_estado]
      ON [telefonia].[sesiones_agente] (
        [estado]
      );
    `);

    await queryRunner.query(`
      CREATE INDEX
        [IX_telefonia_sesiones_heartbeat]
      ON [telefonia].[sesiones_agente] (
        [ultimo_heartbeat_en]
      )
      INCLUDE (
        [agente_id],
        [extension_id],
        [estado],
        [desconectado_en]
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE
        [telefonia].[sesiones_agente];
    `);

    await queryRunner.query(`
      DROP TABLE
        [telefonia].[extensiones];
    `);

    await queryRunner.query(`
      DROP TABLE
        [telefonia].[agentes];
    `);
  }
}
