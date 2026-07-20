export const PHONE_NUMBER_KIND = {
  MOBILE: 'MOBILE',
  FIXED: 'FIXED',
} as const;

export type PhoneNumberKind =
  (typeof PHONE_NUMBER_KIND)[keyof typeof PHONE_NUMBER_KIND];

export const PHONE_NORMALIZATION_FAILURE = {
  EMPTY_NUMBER: 'EMPTY_NUMBER',
  UNSUPPORTED_COUNTRY: 'UNSUPPORTED_COUNTRY',
  INVALID_MOBILE_FORMAT: 'INVALID_MOBILE_FORMAT',
  INVALID_FIXED_FORMAT: 'INVALID_FIXED_FORMAT',
  UNSUPPORTED_LENGTH: 'UNSUPPORTED_LENGTH',
} as const;

export type PhoneNormalizationFailureCode =
  (typeof PHONE_NORMALIZATION_FAILURE)[keyof typeof PHONE_NORMALIZATION_FAILURE];

export interface NormalizePeruPhoneInput {
  readonly countryCode: string | null;
  readonly phonePrefix: string | null;
  readonly phoneNumber: string;
}

export interface NormalizedPeruPhoneNumber {
  readonly countryCode: string;
  readonly nationalNumber: string;
  readonly e164Number: string;
  readonly kind: PhoneNumberKind;
}

export type PhoneNormalizationResult =
  | {
      readonly success: true;
      readonly value: NormalizedPeruPhoneNumber;
    }
  | {
      readonly success: false;
      readonly reason: PhoneNormalizationFailureCode;
    };

export class PeruPhoneNumberNormalizer {
  private readonly countryCode: string;
  private readonly defaultAreaCode: string | null;

  constructor(countryCode = '51', defaultAreaCode: string | null = '1') {
    const normalizedCountryCode = this.onlyDigits(countryCode);

    if (!normalizedCountryCode) {
      throw new Error('Default country code is required');
    }

    this.countryCode = normalizedCountryCode;

    const normalizedAreaCode = this.onlyDigits(defaultAreaCode ?? '');

    this.defaultAreaCode = normalizedAreaCode || null;
  }

  normalize(input: NormalizePeruPhoneInput): PhoneNormalizationResult {
    const receivedCountryCode = this.onlyDigits(
      input.countryCode ?? this.countryCode,
    );

    if (receivedCountryCode && receivedCountryCode !== this.countryCode) {
      return {
        success: false,
        reason: PHONE_NORMALIZATION_FAILURE.UNSUPPORTED_COUNTRY,
      };
    }

    let phoneNumber = this.onlyDigits(input.phoneNumber);

    if (!phoneNumber) {
      return {
        success: false,
        reason: PHONE_NORMALIZATION_FAILURE.EMPTY_NUMBER,
      };
    }

    phoneNumber = this.removeInternationalPrefix(phoneNumber);

    /*
     * Casos como 051987654321:
     * elimina el cero previo al código 51.
     */
    if (phoneNumber.startsWith(`0${this.countryCode}`)) {
      phoneNumber = phoneNumber.slice(1);
    }

    /*
     * Si ya viene como 51 + número nacional,
     * se elimina 51 para trabajar internamente
     * con el formato nacional.
     */
    if (phoneNumber.startsWith(this.countryCode)) {
      const withoutCountry = phoneNumber.slice(this.countryCode.length);

      if (withoutCountry.length === 8 || withoutCountry.length === 9) {
        phoneNumber = withoutCountry;
      }
    }

    /*
     * Admite un cero de marcación nacional
     * antes del número nacional.
     */
    if (phoneNumber.startsWith('0')) {
      const withoutTrunkPrefix = phoneNumber.slice(1);

      if (withoutTrunkPrefix.length === 8 || withoutTrunkPrefix.length === 9) {
        phoneNumber = withoutTrunkPrefix;
      }
    }

    if (phoneNumber.length === 9) {
      if (!phoneNumber.startsWith('9')) {
        return {
          success: false,
          reason: PHONE_NORMALIZATION_FAILURE.INVALID_MOBILE_FORMAT,
        };
      }

      return this.success(phoneNumber, PHONE_NUMBER_KIND.MOBILE);
    }

    if (phoneNumber.length === 8) {
      if (phoneNumber.startsWith('9')) {
        return {
          success: false,
          reason: PHONE_NORMALIZATION_FAILURE.INVALID_FIXED_FORMAT,
        };
      }

      return this.success(phoneNumber, PHONE_NUMBER_KIND.FIXED);
    }

    const areaCode = this.resolveAreaCode(input.phonePrefix);

    /*
     * Lima:
     * área 1 + abonado de 7 dígitos.
     */
    if (phoneNumber.length === 7 && areaCode?.length === 1) {
      return this.success(`${areaCode}${phoneNumber}`, PHONE_NUMBER_KIND.FIXED);
    }

    /*
     * Provincias:
     * área de 2 dígitos +
     * abonado de 6 dígitos.
     */
    if (phoneNumber.length === 6 && areaCode?.length === 2) {
      return this.success(`${areaCode}${phoneNumber}`, PHONE_NUMBER_KIND.FIXED);
    }

    return {
      success: false,
      reason: PHONE_NORMALIZATION_FAILURE.UNSUPPORTED_LENGTH,
    };
  }

  private success(
    nationalNumber: string,
    kind: PhoneNumberKind,
  ): PhoneNormalizationResult {
    return {
      success: true,
      value: {
        countryCode: this.countryCode,

        nationalNumber,

        e164Number: `+${this.countryCode}${nationalNumber}`,

        kind,
      },
    };
  }

  private resolveAreaCode(rawPrefix: string | null): string | null {
    let prefix = this.onlyDigits(rawPrefix ?? '');

    if (!prefix) {
      return this.defaultAreaCode;
    }

    prefix = this.removeInternationalPrefix(prefix);

    prefix = prefix.replace(/^0+/, '');

    if (prefix.startsWith(this.countryCode)) {
      prefix = prefix.slice(this.countryCode.length);
    }

    prefix = prefix.replace(/^0+/, '');

    return prefix || this.defaultAreaCode;
  }

  private removeInternationalPrefix(value: string): string {
    return value.startsWith('00') ? value.slice(2) : value;
  }

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }
}
