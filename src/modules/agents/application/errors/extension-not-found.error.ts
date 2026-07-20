import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class ExtensionNotFoundError extends ApplicationError {
  constructor(extensionId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.NOT_FOUND,

      code: 'EXTENSION_NOT_FOUND',

      message:
        'The requested telephony extension does not exist or is inactive',

      details: {
        extensionId,
      },
    });

    this.name = ExtensionNotFoundError.name;
  }
}

export function createExtensionNotFoundError(
  extensionId: string,
): ExtensionNotFoundError {
  return new ExtensionNotFoundError(extensionId);
}
