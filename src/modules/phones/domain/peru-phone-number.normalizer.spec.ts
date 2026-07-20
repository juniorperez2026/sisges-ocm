import {
  PHONE_NORMALIZATION_FAILURE,
  PHONE_NUMBER_KIND,
  PeruPhoneNumberNormalizer,
} from './peru-phone-number.normalizer';

describe('PeruPhoneNumberNormalizer', () => {
  const normalizer = new PeruPhoneNumberNormalizer('51', '1');

  it('normalizes a 9-digit mobile number', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '999999999',
    });

    expect(result).toEqual({
      success: true,
      value: {
        countryCode: '51',
        nationalNumber: '999999999',
        e164Number: '+51999999999',
        kind: PHONE_NUMBER_KIND.MOBILE,
      },
    });
  });

  it('normalizes an international mobile number', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '+51 999 999 999',
    });

    expect(result).toMatchObject({
      success: true,
      value: {
        nationalNumber: '999999999',
        e164Number: '+51999999999',
      },
    });
  });

  it('normalizes a 7-digit Lima fixed number with prefix 01', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: '01',
      phoneNumber: '2345678',
    });

    expect(result).toEqual({
      success: true,
      value: {
        countryCode: '51',
        nationalNumber: '12345678',
        e164Number: '+5112345678',
        kind: PHONE_NUMBER_KIND.FIXED,
      },
    });
  });

  it('uses Lima area code when a 7-digit number has no prefix', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '2345678',
    });

    expect(result).toMatchObject({
      success: true,
      value: {
        nationalNumber: '12345678',
        kind: PHONE_NUMBER_KIND.FIXED,
      },
    });
  });

  it('accepts an 8-digit national fixed number', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '12345678',
    });

    expect(result).toMatchObject({
      success: true,
      value: {
        e164Number: '+5112345678',
        kind: PHONE_NUMBER_KIND.FIXED,
      },
    });
  });

  it('rejects an invalid 9-digit number that is not mobile', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '123456789',
    });

    expect(result).toEqual({
      success: false,
      reason: PHONE_NORMALIZATION_FAILURE.INVALID_MOBILE_FORMAT,
    });
  });

  it('rejects an unsupported length', () => {
    const result = normalizer.normalize({
      countryCode: '51',
      phonePrefix: null,
      phoneNumber: '12345',
    });

    expect(result).toEqual({
      success: false,
      reason: PHONE_NORMALIZATION_FAILURE.UNSUPPORTED_LENGTH,
    });
  });
});
