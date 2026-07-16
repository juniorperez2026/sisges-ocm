export interface DomainRuleViolationErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class DomainRuleViolationError extends Error {
  public readonly code: string;

  public readonly details: Readonly<Record<string, unknown>>;

  constructor(options: DomainRuleViolationErrorOptions) {
    super(options.message);

    this.name = DomainRuleViolationError.name;
    this.code = options.code;
    this.details = Object.freeze({
      ...(options.details ?? {}),
    });
  }
}
