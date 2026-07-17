'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const sql = require('mssql');

const {
  createSqlServerConfig,
  resolveErrorDetails,
} = require('./lib/sql-server-config.cjs');

const KEYWORD_CONDITION = `
  LOWER(object_name) LIKE '%gestion%'
  OR LOWER(object_name) LIKE '%deudor%'
  OR LOWER(object_name) LIKE '%cliente%'
  OR LOWER(object_name) LIKE '%telefono%'
  OR LOWER(object_name) LIKE '%cartera%'
  OR LOWER(object_name) LIKE '%usuario%'
  OR LOWER(object_name) LIKE '%cobranza%'
  OR LOWER(object_name) LIKE '%contrato%'
  OR LOWER(object_name) LIKE '%contacto%'
`;

async function executeQuery(pool, query) {
  const result = await pool.request().query(query);

  return result.recordset;
}

function createTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
}

async function main() {
  const configuration = createSqlServerConfig(
    'telefonia-backend-metadata-inspection',
  );

  let connectionPool;

  try {
    connectionPool =
      await new sql.ConnectionPool(
        configuration,
      ).connect();

    const databaseInformation =
      await executeQuery(
        connectionPool,
        `
          SELECT
            CAST(
              SERVERPROPERTY('ServerName')
              AS nvarchar(256)
            ) AS serverName,

            CAST(
              SERVERPROPERTY('ProductVersion')
              AS nvarchar(128)
            ) AS productVersion,

            CAST(
              SERVERPROPERTY('Edition')
              AS nvarchar(256)
            ) AS edition,

            d.name AS databaseName,
            d.compatibility_level AS compatibilityLevel,
            d.collation_name AS collationName,
            d.recovery_model_desc AS recoveryModel,
            d.is_read_committed_snapshot_on
              AS readCommittedSnapshotEnabled,
            d.snapshot_isolation_state_desc
              AS snapshotIsolationState

          FROM sys.databases AS d
          WHERE d.name = DB_NAME();
        `,
      );

    const securityInformation =
      await executeQuery(
        connectionPool,
        `
          SELECT
            SUSER_SNAME() AS loginName,
            USER_NAME() AS databaseUser,
            SCHEMA_NAME() AS defaultSchema,

            IS_MEMBER(N'db_owner')
              AS isDbOwner,

            IS_MEMBER(N'db_datareader')
              AS isDbDataReader,

            IS_MEMBER(N'db_datawriter')
              AS isDbDataWriter,

            HAS_PERMS_BY_NAME(
              DB_NAME(),
              'DATABASE',
              'VIEW DEFINITION'
            ) AS canViewDefinition,

            HAS_PERMS_BY_NAME(
              DB_NAME(),
              'DATABASE',
              'CREATE SCHEMA'
            ) AS canCreateSchema,

            HAS_PERMS_BY_NAME(
              DB_NAME(),
              'DATABASE',
              'CREATE TABLE'
            ) AS canCreateTable,

            HAS_PERMS_BY_NAME(
              DB_NAME(),
              'DATABASE',
              'CONTROL'
            ) AS hasDatabaseControl;
        `,
      );

    const roleMemberships =
      await executeQuery(
        connectionPool,
        `
          SELECT
            rolePrincipal.name AS roleName,
            memberPrincipal.name AS memberName

          FROM sys.database_role_members AS roleMember

          INNER JOIN sys.database_principals
            AS rolePrincipal
            ON rolePrincipal.principal_id =
              roleMember.role_principal_id

          INNER JOIN sys.database_principals
            AS memberPrincipal
            ON memberPrincipal.principal_id =
              roleMember.member_principal_id

          WHERE memberPrincipal.name = USER_NAME()

          ORDER BY rolePrincipal.name;
        `,
      );

    const schemas =
      await executeQuery(
        connectionPool,
        `
          SELECT
            schemaObject.name AS schemaName,
            USER_NAME(
              schemaObject.principal_id
            ) AS ownerName,

            CASE
              WHEN schemaObject.name = N'telefonia'
                THEN 1
              ELSE 0
            END AS isTelephonySchema

          FROM sys.schemas AS schemaObject

          WHERE schemaObject.name NOT IN (
            N'db_accessadmin',
            N'db_backupoperator',
            N'db_datareader',
            N'db_datawriter',
            N'db_ddladmin',
            N'db_denydatareader',
            N'db_denydatawriter',
            N'db_owner',
            N'db_securityadmin'
          )

          ORDER BY schemaObject.name;
        `,
      );

    const objectCounts =
      await executeQuery(
        connectionPool,
        `
          SELECT
            schemaObject.name AS schemaName,

            SUM(
              CASE
                WHEN databaseObject.type = 'U'
                  THEN 1
                ELSE 0
              END
            ) AS tableCount,

            SUM(
              CASE
                WHEN databaseObject.type = 'V'
                  THEN 1
                ELSE 0
              END
            ) AS viewCount,

            SUM(
              CASE
                WHEN databaseObject.type IN ('P', 'PC')
                  THEN 1
                ELSE 0
              END
            ) AS procedureCount,

            SUM(
              CASE
                WHEN databaseObject.type = 'TR'
                  THEN 1
                ELSE 0
              END
            ) AS triggerCount

          FROM sys.schemas AS schemaObject

          LEFT JOIN sys.objects AS databaseObject
            ON databaseObject.schema_id =
              schemaObject.schema_id
            AND databaseObject.is_ms_shipped = 0

          GROUP BY schemaObject.name

          HAVING COUNT(databaseObject.object_id) > 0

          ORDER BY schemaObject.name;
        `,
      );

    const candidateObjects =
      await executeQuery(
        connectionPool,
        `
          WITH CandidateObjects AS (
            SELECT
              databaseObject.object_id,
              schemaObject.name AS schemaName,
              databaseObject.name AS object_name,
              databaseObject.type AS objectType,
              databaseObject.type_desc AS objectTypeDescription,
              databaseObject.create_date AS createdAt,
              databaseObject.modify_date AS modifiedAt,

              CASE
                WHEN LOWER(databaseObject.name)
                  LIKE '%gestion%'
                  OR LOWER(databaseObject.name)
                    LIKE '%deudor%'
                  OR LOWER(databaseObject.name)
                    LIKE '%cliente%'
                  OR LOWER(databaseObject.name)
                    LIKE '%telefono%'
                  OR LOWER(databaseObject.name)
                    LIKE '%cartera%'
                  OR LOWER(databaseObject.name)
                    LIKE '%usuario%'
                  OR LOWER(databaseObject.name)
                    LIKE '%cobranza%'
                  OR LOWER(databaseObject.name)
                    LIKE '%contrato%'
                  OR LOWER(databaseObject.name)
                    LIKE '%contacto%'
                THEN 'NAME'
                ELSE 'DEFINITION'
              END AS matchedBy

            FROM sys.objects AS databaseObject

            INNER JOIN sys.schemas AS schemaObject
              ON schemaObject.schema_id =
                databaseObject.schema_id

            LEFT JOIN sys.sql_modules AS moduleDefinition
              ON moduleDefinition.object_id =
                databaseObject.object_id

            WHERE databaseObject.is_ms_shipped = 0
              AND (
                LOWER(databaseObject.name)
                  LIKE '%gestion%'
                OR LOWER(databaseObject.name)
                  LIKE '%deudor%'
                OR LOWER(databaseObject.name)
                  LIKE '%cliente%'
                OR LOWER(databaseObject.name)
                  LIKE '%telefono%'
                OR LOWER(databaseObject.name)
                  LIKE '%cartera%'
                OR LOWER(databaseObject.name)
                  LIKE '%usuario%'
                OR LOWER(databaseObject.name)
                  LIKE '%cobranza%'
                OR LOWER(databaseObject.name)
                  LIKE '%contrato%'
                OR LOWER(databaseObject.name)
                  LIKE '%contacto%'
                OR LOWER(
                  COALESCE(
                    moduleDefinition.definition,
                    ''
                  )
                ) LIKE '%gestion%'
                OR LOWER(
                  COALESCE(
                    moduleDefinition.definition,
                    ''
                  )
                ) LIKE '%deudor%'
                OR LOWER(
                  COALESCE(
                    moduleDefinition.definition,
                    ''
                  )
                ) LIKE '%telefono%'
              )
          )

          SELECT TOP (500)
            schemaName,
            object_name AS objectName,
            objectType,
            objectTypeDescription,
            matchedBy,
            createdAt,
            modifiedAt

          FROM CandidateObjects

          ORDER BY
            objectTypeDescription,
            schemaName,
            object_name;
        `,
      );

    const candidateColumns =
      await executeQuery(
        connectionPool,
        `
          SELECT TOP (1000)
            schemaObject.name AS schemaName,
            tableObject.name AS tableName,
            columnObject.column_id AS columnOrder,
            columnObject.name AS columnName,
            typeObject.name AS dataType,
            columnObject.max_length AS maxLength,
            columnObject.precision,
            columnObject.scale,
            columnObject.is_nullable AS isNullable,
            columnObject.is_identity AS isIdentity,
            columnObject.is_computed AS isComputed

          FROM sys.tables AS tableObject

          INNER JOIN sys.schemas AS schemaObject
            ON schemaObject.schema_id =
              tableObject.schema_id

          INNER JOIN sys.columns AS columnObject
            ON columnObject.object_id =
              tableObject.object_id

          INNER JOIN sys.types AS typeObject
            ON typeObject.user_type_id =
              columnObject.user_type_id

          WHERE tableObject.is_ms_shipped = 0
            AND (
              LOWER(tableObject.name)
                LIKE '%gestion%'
              OR LOWER(tableObject.name)
                LIKE '%deudor%'
              OR LOWER(tableObject.name)
                LIKE '%cliente%'
              OR LOWER(tableObject.name)
                LIKE '%telefono%'
              OR LOWER(tableObject.name)
                LIKE '%cartera%'
              OR LOWER(tableObject.name)
                LIKE '%usuario%'
              OR LOWER(tableObject.name)
                LIKE '%cobranza%'
              OR LOWER(tableObject.name)
                LIKE '%contrato%'
              OR LOWER(tableObject.name)
                LIKE '%contacto%'
              OR LOWER(columnObject.name)
                LIKE '%gestion%'
              OR LOWER(columnObject.name)
                LIKE '%deudor%'
              OR LOWER(columnObject.name)
                LIKE '%cliente%'
              OR LOWER(columnObject.name)
                LIKE '%telefono%'
              OR LOWER(columnObject.name)
                LIKE '%cartera%'
              OR LOWER(columnObject.name)
                LIKE '%usuario%'
            )

          ORDER BY
            schemaObject.name,
            tableObject.name,
            columnObject.column_id;
        `,
      );

    const candidateProcedureParameters =
      await executeQuery(
        connectionPool,
        `
          SELECT TOP (1000)
            schemaObject.name AS schemaName,
            procedureObject.name AS procedureName,
            parameterObject.parameter_id AS parameterOrder,
            parameterObject.name AS parameterName,
            typeObject.name AS dataType,
            parameterObject.max_length AS maxLength,
            parameterObject.precision,
            parameterObject.scale,
            parameterObject.is_output AS isOutput

          FROM sys.procedures AS procedureObject

          INNER JOIN sys.schemas AS schemaObject
            ON schemaObject.schema_id =
              procedureObject.schema_id

          LEFT JOIN sys.parameters AS parameterObject
            ON parameterObject.object_id =
              procedureObject.object_id

          LEFT JOIN sys.types AS typeObject
            ON typeObject.user_type_id =
              parameterObject.user_type_id

          LEFT JOIN sys.sql_modules AS moduleDefinition
            ON moduleDefinition.object_id =
              procedureObject.object_id

          WHERE procedureObject.is_ms_shipped = 0
            AND (
              LOWER(procedureObject.name)
                LIKE '%gestion%'
              OR LOWER(procedureObject.name)
                LIKE '%deudor%'
              OR LOWER(procedureObject.name)
                LIKE '%cliente%'
              OR LOWER(procedureObject.name)
                LIKE '%telefono%'
              OR LOWER(procedureObject.name)
                LIKE '%cartera%'
              OR LOWER(procedureObject.name)
                LIKE '%usuario%'
              OR LOWER(procedureObject.name)
                LIKE '%cobranza%'
              OR LOWER(procedureObject.name)
                LIKE '%contrato%'
              OR LOWER(
                COALESCE(
                  moduleDefinition.definition,
                  ''
                )
              ) LIKE '%gestion%'
            )

          ORDER BY
            schemaObject.name,
            procedureObject.name,
            parameterObject.parameter_id;
        `,
      );

    const triggers =
      await executeQuery(
        connectionPool,
        `
          SELECT
            triggerSchema.name AS triggerSchema,
            triggerObject.name AS triggerName,

            parentSchema.name AS parentSchema,
            parentObject.name AS parentObject,

            triggerObject.is_disabled AS isDisabled,
            triggerObject.is_instead_of_trigger
              AS isInsteadOfTrigger,

            triggerObject.create_date AS createdAt,
            triggerObject.modify_date AS modifiedAt

          FROM sys.triggers AS triggerObject

          LEFT JOIN sys.objects AS triggerSchemaObject
            ON triggerSchemaObject.object_id =
              triggerObject.object_id

          LEFT JOIN sys.schemas AS triggerSchema
            ON triggerSchema.schema_id =
              triggerSchemaObject.schema_id

          LEFT JOIN sys.objects AS parentObject
            ON parentObject.object_id =
              triggerObject.parent_id

          LEFT JOIN sys.schemas AS parentSchema
            ON parentSchema.schema_id =
              parentObject.schema_id

          WHERE triggerObject.is_ms_shipped = 0

          ORDER BY
            parentSchema.name,
            parentObject.name,
            triggerObject.name;
        `,
      );

    const primaryKeys =
      await executeQuery(
        connectionPool,
        `
          SELECT
            schemaObject.name AS schemaName,
            tableObject.name AS tableName,
            keyConstraint.name AS constraintName,
            indexColumn.key_ordinal AS keyOrder,
            columnObject.name AS columnName

          FROM sys.key_constraints AS keyConstraint

          INNER JOIN sys.tables AS tableObject
            ON tableObject.object_id =
              keyConstraint.parent_object_id

          INNER JOIN sys.schemas AS schemaObject
            ON schemaObject.schema_id =
              tableObject.schema_id

          INNER JOIN sys.index_columns AS indexColumn
            ON indexColumn.object_id =
              tableObject.object_id
            AND indexColumn.index_id =
              keyConstraint.unique_index_id

          INNER JOIN sys.columns AS columnObject
            ON columnObject.object_id =
              tableObject.object_id
            AND columnObject.column_id =
              indexColumn.column_id

          WHERE keyConstraint.type = 'PK'
            AND (
              LOWER(tableObject.name)
                LIKE '%gestion%'
              OR LOWER(tableObject.name)
                LIKE '%deudor%'
              OR LOWER(tableObject.name)
                LIKE '%cliente%'
              OR LOWER(tableObject.name)
                LIKE '%telefono%'
              OR LOWER(tableObject.name)
                LIKE '%cartera%'
              OR LOWER(tableObject.name)
                LIKE '%usuario%'
              OR LOWER(tableObject.name)
                LIKE '%cobranza%'
              OR LOWER(tableObject.name)
                LIKE '%contrato%'
              OR LOWER(tableObject.name)
                LIKE '%contacto%'
            )

          ORDER BY
            schemaObject.name,
            tableObject.name,
            indexColumn.key_ordinal;
        `,
      );

    const foreignKeys =
      await executeQuery(
        connectionPool,
        `
          SELECT TOP (1000)
            parentSchema.name AS parentSchema,
            parentTable.name AS parentTable,
            foreignKey.name AS foreignKeyName,
            parentColumn.name AS parentColumn,

            referencedSchema.name
              AS referencedSchema,
            referencedTable.name
              AS referencedTable,
            referencedColumn.name
              AS referencedColumn,

            foreignKey.delete_referential_action_desc
              AS deleteAction,

            foreignKey.update_referential_action_desc
              AS updateAction,

            foreignKey.is_disabled AS isDisabled,
            foreignKey.is_not_trusted AS isNotTrusted

          FROM sys.foreign_keys AS foreignKey

          INNER JOIN sys.foreign_key_columns
            AS foreignKeyColumn
            ON foreignKeyColumn.constraint_object_id =
              foreignKey.object_id

          INNER JOIN sys.tables AS parentTable
            ON parentTable.object_id =
              foreignKey.parent_object_id

          INNER JOIN sys.schemas AS parentSchema
            ON parentSchema.schema_id =
              parentTable.schema_id

          INNER JOIN sys.columns AS parentColumn
            ON parentColumn.object_id =
              parentTable.object_id
            AND parentColumn.column_id =
              foreignKeyColumn.parent_column_id

          INNER JOIN sys.tables AS referencedTable
            ON referencedTable.object_id =
              foreignKey.referenced_object_id

          INNER JOIN sys.schemas AS referencedSchema
            ON referencedSchema.schema_id =
              referencedTable.schema_id

          INNER JOIN sys.columns AS referencedColumn
            ON referencedColumn.object_id =
              referencedTable.object_id
            AND referencedColumn.column_id =
              foreignKeyColumn.referenced_column_id

          WHERE
            LOWER(parentTable.name)
              LIKE '%gestion%'
            OR LOWER(parentTable.name)
              LIKE '%deudor%'
            OR LOWER(parentTable.name)
              LIKE '%cliente%'
            OR LOWER(parentTable.name)
              LIKE '%telefono%'
            OR LOWER(parentTable.name)
              LIKE '%cartera%'
            OR LOWER(parentTable.name)
              LIKE '%usuario%'
            OR LOWER(parentTable.name)
              LIKE '%cobranza%'
            OR LOWER(parentTable.name)
              LIKE '%contrato%'
            OR LOWER(parentTable.name)
              LIKE '%contacto%'
            OR LOWER(referencedTable.name)
              LIKE '%gestion%'
            OR LOWER(referencedTable.name)
              LIKE '%deudor%'
            OR LOWER(referencedTable.name)
              LIKE '%cliente%'
            OR LOWER(referencedTable.name)
              LIKE '%telefono%'

          ORDER BY
            parentSchema.name,
            parentTable.name,
            foreignKey.name,
            foreignKeyColumn.constraint_column_id;
        `,
      );

    const telephonyObjects =
      await executeQuery(
        connectionPool,
        `
          SELECT
            schemaObject.name AS schemaName,
            databaseObject.name AS objectName,
            databaseObject.type_desc
              AS objectTypeDescription

          FROM sys.objects AS databaseObject

          INNER JOIN sys.schemas AS schemaObject
            ON schemaObject.schema_id =
              databaseObject.schema_id

          WHERE schemaObject.name = N'telefonia'
            AND databaseObject.is_ms_shipped = 0

          ORDER BY
            databaseObject.type_desc,
            databaseObject.name;
        `,
      );

    const report = {
      generatedAt: new Date().toISOString(),

      inspectionMode: 'METADATA_ONLY',

      guarantees: [
        'No application table rows were queried',
        'No INSERT, UPDATE or DELETE statements were executed',
        'No database objects were created or modified',
      ],

      database:
        databaseInformation[0] ?? null,

      security:
        securityInformation[0] ?? null,

      roleMemberships,
      schemas,
      objectCounts,

      telephonySchema: {
        exists: schemas.some(
          (item) =>
            item.schemaName === 'telefonia',
        ),
        objects: telephonyObjects,
      },

      candidates: {
        objects: candidateObjects,
        columns: candidateColumns,
        procedureParameters:
          candidateProcedureParameters,
        triggers,
        primaryKeys,
        foreignKeys,
      },
    };

    const outputDirectory = path.resolve(
      process.cwd(),
      'local-artifacts',
    );

    await fs.mkdir(
      outputDirectory,
      {
        recursive: true,
      },
    );

    const outputFile = path.join(
      outputDirectory,
      `sql-server-inventory-${createTimestamp()}.json`,
    );

    await fs.writeFile(
      outputFile,
      JSON.stringify(report, null, 2),
      'utf8',
    );

    console.log(
      JSON.stringify(
        {
          inspected: true,
          mode: report.inspectionMode,

          database: report.database,

          security: report.security,

          telephonySchemaExists:
            report.telephonySchema.exists,

          counts: {
            schemas: report.schemas.length,

            candidateObjects:
              candidateObjects.length,

            candidateColumns:
              candidateColumns.length,

            candidateProcedureParameters:
              candidateProcedureParameters.length,

            triggers: triggers.length,

            primaryKeys:
              primaryKeys.length,

            foreignKeys:
              foreignKeys.length,
          },

          outputFile,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          inspected: false,
          error:
            resolveErrorDetails(error),
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  } finally {
    if (connectionPool) {
      await connectionPool.close();
    }
  }
}

void main();
