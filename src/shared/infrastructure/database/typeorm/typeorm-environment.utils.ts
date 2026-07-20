export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export function requireEnvironmentValue(
  environment: EnvironmentSource,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value || value === 'change-this-value') {
    throw new Error(`Environment variable ${name} is not configured`);
  }

  return value;
}

export function readEnvironmentInteger(
  environment: EnvironmentSource,
  name: string,
  defaultValue: number,
): number {
  const rawValue = environment[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(
      `Environment variable ${name} must be a non-negative integer`,
    );
  }

  return parsedValue;
}

export function readEnvironmentBoolean(
  environment: EnvironmentSource,
  name: string,
  defaultValue: boolean,
): boolean {
  const rawValue = environment[name]?.trim().toLowerCase();

  if (!rawValue) {
    return defaultValue;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`Environment variable ${name} must be true or false`);
}

export function readSqlIdentifier(
  environment: EnvironmentSource,
  name: string,
  defaultValue: string,
): string {
  const value = environment[name]?.trim() || defaultValue;

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(
      `Environment variable ${name} contains an invalid SQL identifier`,
    );
  }

  return value;
}
