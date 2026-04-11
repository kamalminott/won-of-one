export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

const COUNTRY_NAME_BY_CODE: Record<string, string> = {
  AD: 'Andorra',
  AE: 'United Arab Emirates',
  AF: 'Afghanistan',
  AG: 'Antigua and Barbuda',
  AL: 'Albania',
  AM: 'Armenia',
  AO: 'Angola',
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina',
  BB: 'Barbados',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BF: 'Burkina Faso',
  BG: 'Bulgaria',
  BH: 'Bahrain',
  BI: 'Burundi',
  BJ: 'Benin',
  BN: 'Brunei',
  BO: 'Bolivia',
  BR: 'Brazil',
  BS: 'Bahamas',
  BT: 'Bhutan',
  BW: 'Botswana',
  BY: 'Belarus',
  BZ: 'Belize',
  CA: 'Canada',
  CD: 'Democratic Republic of the Congo',
  CF: 'Central African Republic',
  CG: 'Republic of the Congo',
  CH: 'Switzerland',
  CI: 'Cote d\'Ivoire',
  CL: 'Chile',
  CM: 'Cameroon',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CV: 'Cape Verde',
  CY: 'Cyprus',
  CZ: 'Czech Republic',
  DE: 'Germany',
  DJ: 'Djibouti',
  DK: 'Denmark',
  DM: 'Dominica',
  DO: 'Dominican Republic',
  DZ: 'Algeria',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  ER: 'Eritrea',
  ES: 'Spain',
  ET: 'Ethiopia',
  FI: 'Finland',
  FJ: 'Fiji',
  FM: 'Micronesia',
  FR: 'France',
  GA: 'Gabon',
  GB: 'United Kingdom',
  GD: 'Grenada',
  GE: 'Georgia',
  GH: 'Ghana',
  GM: 'Gambia',
  GN: 'Guinea',
  GQ: 'Equatorial Guinea',
  GR: 'Greece',
  GT: 'Guatemala',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HN: 'Honduras',
  HR: 'Croatia',
  HT: 'Haiti',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KH: 'Cambodia',
  KI: 'Kiribati',
  KM: 'Comoros',
  KN: 'Saint Kitts and Nevis',
  KP: 'North Korea',
  KR: 'South Korea',
  KW: 'Kuwait',
  KZ: 'Kazakhstan',
  LA: 'Laos',
  LB: 'Lebanon',
  LC: 'Saint Lucia',
  LI: 'Liechtenstein',
  LK: 'Sri Lanka',
  LR: 'Liberia',
  LS: 'Lesotho',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  LY: 'Libya',
  MA: 'Morocco',
  MC: 'Monaco',
  MD: 'Moldova',
  ME: 'Montenegro',
  MG: 'Madagascar',
  MH: 'Marshall Islands',
  MK: 'North Macedonia',
  ML: 'Mali',
  MM: 'Myanmar',
  MN: 'Mongolia',
  MR: 'Mauritania',
  MT: 'Malta',
  MU: 'Mauritius',
  MV: 'Maldives',
  MW: 'Malawi',
  MX: 'Mexico',
  MY: 'Malaysia',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NE: 'Niger',
  NG: 'Nigeria',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  NO: 'Norway',
  NP: 'Nepal',
  NR: 'Nauru',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PG: 'Papua New Guinea',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PS: 'Palestine',
  PT: 'Portugal',
  PW: 'Palau',
  PY: 'Paraguay',
  QA: 'Qatar',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SB: 'Solomon Islands',
  SC: 'Seychelles',
  SD: 'Sudan',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  SL: 'Sierra Leone',
  SM: 'San Marino',
  SN: 'Senegal',
  SO: 'Somalia',
  SR: 'Suriname',
  SS: 'South Sudan',
  ST: 'Sao Tome and Principe',
  SV: 'El Salvador',
  SY: 'Syria',
  SZ: 'Eswatini',
  TD: 'Chad',
  TG: 'Togo',
  TH: 'Thailand',
  TJ: 'Tajikistan',
  TL: 'Timor-Leste',
  TM: 'Turkmenistan',
  TN: 'Tunisia',
  TO: 'Tonga',
  TR: 'Turkey',
  TT: 'Trinidad and Tobago',
  TV: 'Tuvalu',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  UA: 'Ukraine',
  UG: 'Uganda',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VA: 'Vatican City',
  VC: 'Saint Vincent and the Grenadines',
  VE: 'Venezuela',
  VN: 'Vietnam',
  VU: 'Vanuatu',
  WS: 'Samoa',
  YE: 'Yemen',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

const displayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

export const getCountryFlagEmoji = (code?: string | null): string => {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return '';
  }

  return String.fromCodePoint(
    normalized.charCodeAt(0) + 127397,
    normalized.charCodeAt(1) + 127397
  );
};

export const getCountryName = (code?: string | null): string | null => {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  const fallbackName = COUNTRY_NAME_BY_CODE[normalized];
  const intlName = displayNames?.of(normalized) ?? null;

  if (intlName && intlName !== normalized && !/unknown region|pseudo/i.test(intlName)) {
    return intlName;
  }

  return fallbackName ?? null;
};

export const getCountryDisplay = (code?: string | null): string | null => {
  const name = getCountryName(code);
  const flag = getCountryFlagEmoji(code);
  if (!name || !flag) {
    return null;
  }

  return `${flag} ${name}`;
};

export const COUNTRY_OPTIONS: CountryOption[] = Object.entries(COUNTRY_NAME_BY_CODE)
  .map(([code, name]) => ({
    code,
    name,
    flag: getCountryFlagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
