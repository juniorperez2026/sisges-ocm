export const APPLICATION_ERROR_KIND = {
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
} as const;

export type ApplicationErrorKind =
  (typeof APPLICATION_ERROR_KIND)[keyof typeof APPLICATION_ERROR_KIND];

export interface ApplicationErrorOptions {
  readonly kind: ApplicationErrorKind;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ApplicationError extends Error {
  public readonly kind: ApplicationErrorKind;

  public readonly code: string;

  public readonly details: Readonly<Record<string, unknown>>;

  constructor(options: ApplicationErrorOptions) {
    super(options.message);

    this.name = ApplicationError.name;
    this.kind = options.kind;
    this.code = options.code;
    this.details = Object.freeze({
      ...(options.details ?? {}),
    });
  }
}
