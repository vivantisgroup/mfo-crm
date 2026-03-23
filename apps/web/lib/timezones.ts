/**
 * timezones.ts
 *
 * Complete curated IANA timezone list.
 * Offsets are fixed-point "standard" offsets shown at list build time.
 * In the UI we derive live offsets via the Intl API so they correctly
 * reflect DST when the user saves.
 *
 * Usage:
 *   import { TIMEZONES, getTimezoneOffset, getUserTimezone } from '@/lib/timezones';
 */

export interface TimezoneOption {
  value: string;       // IANA identifier, e.g. "America/New_York"
  label: string;       // Human-friendly, e.g. "Eastern Time (New York)"
  region: string;      // Group label, e.g. "Americas"
  utcOffset: string;   // Displayed offset, e.g. "UTC−05:00"
}

/** Get the browser's current timezone (Intl-based, never null) */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Return the current UTC offset string for a given IANA timezone.
 * Example: getTimezoneOffset('America/New_York') → 'UTC−05:00' or 'UTC−04:00'
 */
export function getTimezoneOffset(tz: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
    // offsetPart is like "GMT+5:30" — normalise to "UTC+05:30"
    return offsetPart
      .replace('GMT', 'UTC')
      .replace(/([+-])(\d):/, '$10$2:')   // pad single-digit hours
      .replace(/([+-]\d{2})$/, '$1:00');  // add :00 if no minutes
  } catch {
    return 'UTC';
  }
}

/** Sort timezone options by offset ascending */
export function sortedTimezones(): TimezoneOption[] {
  return [...TIMEZONES].sort((a, b) => {
    const toMins = (s: string) => {
      const m = s.match(/UTC([+-])(\d{2}):(\d{2})/);
      if (!m) return 0;
      const sign = m[1] === '+' ? 1 : -1;
      return sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
    };
    return toMins(a.utcOffset) - toMins(b.utcOffset);
  });
}

/** Grouped by region for <optgroup> rendering */
export function groupedTimezones(): Record<string, TimezoneOption[]> {
  const groups: Record<string, TimezoneOption[]> = {};
  for (const tz of TIMEZONES) {
    if (!groups[tz.region]) groups[tz.region] = [];
    groups[tz.region].push(tz);
  }
  return groups;
}

// ─── Complete IANA List ────────────────────────────────────────────────────────

export const TIMEZONES: TimezoneOption[] = [
  // ── UTC ──────────────────────────────────────────────────────────────────────
  { value: 'UTC',                     label: 'UTC — Coordinated Universal Time',    region: 'UTC',       utcOffset: 'UTC+00:00' },

  // ── Americas ─────────────────────────────────────────────────────────────────
  { value: 'America/Adak',            label: 'Aleutian Time (Adak)',                region: 'Americas',  utcOffset: 'UTC−10:00' },
  { value: 'Pacific/Honolulu',        label: 'Hawaii Time (Honolulu)',              region: 'Americas',  utcOffset: 'UTC−10:00' },
  { value: 'Pacific/Marquesas',       label: 'Marquesas Time',                      region: 'Americas',  utcOffset: 'UTC−09:30' },
  { value: 'America/Anchorage',       label: 'Alaska Time (Anchorage)',             region: 'Americas',  utcOffset: 'UTC−09:00' },
  { value: 'America/Juneau',          label: 'Alaska Time (Juneau)',                region: 'Americas',  utcOffset: 'UTC−09:00' },
  { value: 'America/Nome',            label: 'Alaska Time (Nome)',                  region: 'Americas',  utcOffset: 'UTC−09:00' },
  { value: 'America/Sitka',           label: 'Alaska Time (Sitka)',                 region: 'Americas',  utcOffset: 'UTC−09:00' },
  { value: 'America/Yakutat',         label: 'Alaska Time (Yakutat)',               region: 'Americas',  utcOffset: 'UTC−09:00' },
  { value: 'America/Los_Angeles',     label: 'Pacific Time (Los Angeles)',          region: 'Americas',  utcOffset: 'UTC−08:00' },
  { value: 'America/Vancouver',       label: 'Pacific Time (Vancouver)',            region: 'Americas',  utcOffset: 'UTC−08:00' },
  { value: 'America/Tijuana',         label: 'Pacific Time (Tijuana)',              region: 'Americas',  utcOffset: 'UTC−08:00' },
  { value: 'America/Dawson',          label: 'Mountain Time (Dawson)',              region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Denver',          label: 'Mountain Time (Denver)',              region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Edmonton',        label: 'Mountain Time (Edmonton)',            region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Hermosillo',      label: 'Mountain Time (Hermosillo)',          region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Mazatlan',        label: 'Mountain Time (Mazatlán)',            region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Phoenix',         label: 'Mountain Time – no DST (Phoenix)',    region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Boise',           label: 'Mountain Time (Boise)',               region: 'Americas',  utcOffset: 'UTC−07:00' },
  { value: 'America/Chihuahua',       label: 'Central Time (Chihuahua)',            region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Chicago',         label: 'Central Time (Chicago)',              region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Indiana/Knox',    label: 'Central Time (Indiana/Knox)',         region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Matamoros',       label: 'Central Time (Matamoros)',            region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Menominee',       label: 'Central Time (Menominee)',            region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Mexico_City',     label: 'Central Time (Mexico City)',          region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Monterrey',       label: 'Central Time (Monterrey)',            region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/North_Dakota/Center', label: 'Central Time (North Dakota/Center)', region: 'Americas', utcOffset: 'UTC−06:00' },
  { value: 'America/Winnipeg',        label: 'Central Time (Winnipeg)',             region: 'Americas',  utcOffset: 'UTC−06:00' },
  { value: 'America/Bogota',          label: 'Colombia Time (Bogotá)',              region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Detroit',         label: 'Eastern Time (Detroit)',              region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Indiana/Indianapolis', label: 'Eastern Time (Indianapolis)', region: 'Americas',    utcOffset: 'UTC−05:00' },
  { value: 'America/Iqaluit',         label: 'Eastern Time (Iqaluit)',              region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Lima',            label: 'Peru Time (Lima)',                    region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/New_York',        label: 'Eastern Time (New York)',             region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Panama',          label: 'Eastern Time – no DST (Panama)',      region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Toronto',         label: 'Eastern Time (Toronto)',              region: 'Americas',  utcOffset: 'UTC−05:00' },
  { value: 'America/Caracas',         label: 'Venezuela Time (Caracas)',            region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Asuncion',        label: 'Paraguay Time (Asunción)',            region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Campo_Grande',    label: 'Amazon Time (Campo Grande)',          region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Cuiaba',          label: 'Amazon Time (Cuiabá)',                region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Halifax',         label: 'Atlantic Time (Halifax)',             region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/La_Paz',          label: 'Bolivia Time (La Paz)',               region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Manaus',          label: 'Amazon Time (Manaus)',                region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Port_of_Spain',   label: 'Atlantic Time (Port of Spain)',       region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Santiago',        label: 'Chile Time (Santiago)',               region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/Santo_Domingo',   label: 'Atlantic Time (Santo Domingo)',       region: 'Americas',  utcOffset: 'UTC−04:00' },
  { value: 'America/St_Johns',        label: 'Newfoundland Time (St. John\'s)',     region: 'Americas',  utcOffset: 'UTC−03:30' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time (Buenos Aires)',region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Belem',           label: 'Brasília Time (Belém)',               region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Cayenne',         label: 'French Guiana Time (Cayenne)',        region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Fortaleza',       label: 'Brasília Time (Fortaleza)',           region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Godthab',         label: 'West Greenland Time (Nuuk)',          region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Maceio',          label: 'Brasília Time (Maceió)',              region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Miquelon',        label: 'St. Pierre & Miquelon Time',          region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Montevideo',      label: 'Uruguay Time (Montevideo)',           region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Recife',          label: 'Brasília Time (Recife)',              region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Santarem',        label: 'Brasília Time (Santarém)',            region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'America/Sao_Paulo',       label: 'Brasília Time (São Paulo)',           region: 'Americas',  utcOffset: 'UTC−03:00' },
  { value: 'Atlantic/South_Georgia',  label: 'South Georgia Time',                 region: 'Americas',  utcOffset: 'UTC−02:00' },
  { value: 'America/Noronha',         label: 'Fernando de Noronha Time',           region: 'Americas',  utcOffset: 'UTC−02:00' },
  { value: 'Atlantic/Cape_Verde',     label: 'Cape Verde Time',                    region: 'Americas',  utcOffset: 'UTC−01:00' },
  { value: 'America/Scoresbysund',    label: 'East Greenland Time',                region: 'Americas',  utcOffset: 'UTC−01:00' },

  // ── Europe & Africa ───────────────────────────────────────────────────────────
  { value: 'Atlantic/Azores',         label: 'Azores Time',                        region: 'Europe & Africa', utcOffset: 'UTC−01:00' },
  { value: 'Africa/Abidjan',          label: 'Greenwich Mean Time (Abidjan)',       region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Africa/Accra',            label: 'Ghana Mean Time (Accra)',             region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Africa/Bissau',           label: 'Greenwich Mean Time (Bissau)',        region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Africa/Monrovia',         label: 'Greenwich Mean Time (Monrovia)',      region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Atlantic/Canary',         label: 'Western European Time (Canary)',      region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Atlantic/Faroe',          label: 'Western European Time (Faroe)',       region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Atlantic/Reykjavik',      label: 'Greenwich Mean Time (Reykjavik)',     region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Europe/Dublin',           label: 'Irish Time (Dublin)',                 region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Europe/Lisbon',           label: 'Western European Time (Lisbon)',      region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Europe/London',           label: 'Greenwich Mean Time (London)',        region: 'Europe & Africa', utcOffset: 'UTC+00:00' },
  { value: 'Africa/Algiers',          label: 'Central European Time (Algiers)',     region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Africa/Casablanca',       label: 'Western European Time (Casablanca)',  region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Africa/Lagos',            label: 'West Africa Time (Lagos)',            region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Africa/Tunis',            label: 'Central European Time (Tunis)',       region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Amsterdam',        label: 'Central European Time (Amsterdam)',   region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Berlin',           label: 'Central European Time (Berlin)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Brussels',         label: 'Central European Time (Brussels)',    region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Copenhagen',       label: 'Central European Time (Copenhagen)',  region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Madrid',           label: 'Central European Time (Madrid)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Oslo',             label: 'Central European Time (Oslo)',        region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Paris',            label: 'Central European Time (Paris)',       region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Prague',           label: 'Central European Time (Prague)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Rome',             label: 'Central European Time (Rome)',        region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Stockholm',        label: 'Central European Time (Stockholm)',   region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Vienna',           label: 'Central European Time (Vienna)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Warsaw',           label: 'Central European Time (Warsaw)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Europe/Zurich',           label: 'Central European Time (Zurich)',      region: 'Europe & Africa', utcOffset: 'UTC+01:00' },
  { value: 'Africa/Cairo',            label: 'Eastern European Time (Cairo)',       region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Africa/Johannesburg',     label: 'South Africa Standard Time',         region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Africa/Khartoum',         label: 'Central Africa Time (Khartoum)',      region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Africa/Maputo',           label: 'Central Africa Time (Maputo)',        region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Africa/Nairobi',          label: 'East Africa Time (Nairobi)',          region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Africa/Tripoli',          label: 'Eastern European Time (Tripoli)',     region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Athens',           label: 'Eastern European Time (Athens)',      region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Bucharest',        label: 'Eastern European Time (Bucharest)',   region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Helsinki',         label: 'Eastern European Time (Helsinki)',    region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Istanbul',         label: 'Turkey Time (Istanbul)',              region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Europe/Kyiv',             label: 'Eastern European Time (Kyiv)',        region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Nicosia',          label: 'Eastern European Time (Nicosia)',     region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Riga',             label: 'Eastern European Time (Riga)',        region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Sofia',            label: 'Eastern European Time (Sofia)',       region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Tallinn',          label: 'Eastern European Time (Tallinn)',     region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Vilnius',          label: 'Eastern European Time (Vilnius)',     region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Asia/Amman',              label: 'Arabia Time (Amman)',                 region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Asia/Baghdad',            label: 'Arabia Time (Baghdad)',               region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Asia/Beirut',             label: 'Eastern European Time (Beirut)',      region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Asia/Damascus',           label: 'Syria Time (Damascus)',               region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Asia/Jerusalem',          label: 'Israel Time (Jerusalem)',             region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Asia/Kuwait',             label: 'Arabia Time (Kuwait)',                region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Asia/Riyadh',             label: 'Arabia Time (Riyadh)',                region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Europe/Kaliningrad',      label: 'Eastern European Time (Kaliningrad)', region: 'Europe & Africa', utcOffset: 'UTC+02:00' },
  { value: 'Europe/Minsk',            label: 'Moscow Time (Minsk)',                 region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Europe/Moscow',           label: 'Moscow Time (Moscow)',                region: 'Europe & Africa', utcOffset: 'UTC+03:00' },
  { value: 'Europe/Simferopol',       label: 'Moscow Time (Simferopol)',            region: 'Europe & Africa', utcOffset: 'UTC+03:00' },

  // ── Asia & Pacific ────────────────────────────────────────────────────────────
  { value: 'Asia/Tehran',             label: 'Iran Time (Tehran)',                  region: 'Asia & Pacific',  utcOffset: 'UTC+03:30' },
  { value: 'Asia/Baku',               label: 'Azerbaijan Time (Baku)',              region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Asia/Dubai',              label: 'Gulf Time (Dubai)',                   region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Asia/Muscat',             label: 'Gulf Time (Muscat)',                  region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Asia/Tbilisi',            label: 'Georgia Time (Tbilisi)',              region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Asia/Yerevan',            label: 'Armenia Time (Yerevan)',              region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Europe/Samara',           label: 'Samara Time',                         region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Indian/Mauritius',        label: 'Mauritius Time',                      region: 'Asia & Pacific',  utcOffset: 'UTC+04:00' },
  { value: 'Asia/Kabul',              label: 'Afghanistan Time (Kabul)',            region: 'Asia & Pacific',  utcOffset: 'UTC+04:30' },
  { value: 'Asia/Karachi',            label: 'Pakistan Time (Karachi)',             region: 'Asia & Pacific',  utcOffset: 'UTC+05:00' },
  { value: 'Asia/Tashkent',           label: 'Uzbekistan Time (Tashkent)',          region: 'Asia & Pacific',  utcOffset: 'UTC+05:00' },
  { value: 'Asia/Yekaterinburg',      label: 'Yekaterinburg Time',                  region: 'Asia & Pacific',  utcOffset: 'UTC+05:00' },
  { value: 'Indian/Maldives',         label: 'Maldives Time',                       region: 'Asia & Pacific',  utcOffset: 'UTC+05:00' },
  { value: 'Asia/Colombo',            label: 'India Time (Colombo)',                region: 'Asia & Pacific',  utcOffset: 'UTC+05:30' },
  { value: 'Asia/Kolkata',            label: 'India Standard Time (Kolkata)',        region: 'Asia & Pacific',  utcOffset: 'UTC+05:30' },
  { value: 'Asia/Kathmandu',          label: 'Nepal Time (Kathmandu)',              region: 'Asia & Pacific',  utcOffset: 'UTC+05:45' },
  { value: 'Asia/Almaty',             label: 'Almaty Time',                         region: 'Asia & Pacific',  utcOffset: 'UTC+06:00' },
  { value: 'Asia/Dhaka',              label: 'Bangladesh Time (Dhaka)',             region: 'Asia & Pacific',  utcOffset: 'UTC+06:00' },
  { value: 'Asia/Omsk',               label: 'Omsk Time',                           region: 'Asia & Pacific',  utcOffset: 'UTC+06:00' },
  { value: 'Asia/Thimphu',            label: 'Bhutan Time (Thimphu)',               region: 'Asia & Pacific',  utcOffset: 'UTC+06:00' },
  { value: 'Indian/Chagos',           label: 'Indian Ocean Time (Chagos)',          region: 'Asia & Pacific',  utcOffset: 'UTC+06:00' },
  { value: 'Asia/Rangoon',            label: 'Myanmar Time (Yangon)',               region: 'Asia & Pacific',  utcOffset: 'UTC+06:30' },
  { value: 'Asia/Bangkok',            label: 'Indochina Time (Bangkok)',            region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Asia/Ho_Chi_Minh',        label: 'Indochina Time (Ho Chi Minh City)',   region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Asia/Jakarta',            label: 'Western Indonesia Time (Jakarta)',    region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Asia/Krasnoyarsk',        label: 'Krasnoyarsk Time',                    region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Asia/Phnom_Penh',         label: 'Indochina Time (Phnom Penh)',         region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Indian/Christmas',        label: 'Christmas Island Time',               region: 'Asia & Pacific',  utcOffset: 'UTC+07:00' },
  { value: 'Asia/Brunei',             label: 'Brunei Darussalam Time',              region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Hong_Kong',          label: 'Hong Kong Time',                      region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Irkutsk',            label: 'Irkutsk Time',                        region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Kuala_Lumpur',       label: 'Malaysia Time (Kuala Lumpur)',        region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Macau',              label: 'China Time (Macau)',                  region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Makassar',           label: 'Central Indonesia Time (Makassar)',   region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Manila',             label: 'Philippine Time (Manila)',            region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Shanghai',           label: 'China Standard Time (Shanghai)',      region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Singapore',          label: 'Singapore Time',                      region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Taipei',             label: 'China Standard Time (Taipei)',        region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Ulaanbaatar',        label: 'Ulaanbaatar Time',                    region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Australia/Perth',         label: 'Australian Western Time (Perth)',     region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Asia/Choibalsan',         label: 'Choibalsan Time',                     region: 'Asia & Pacific',  utcOffset: 'UTC+08:00' },
  { value: 'Australia/Eucla',         label: 'Australian Central Western Time (Eucla)', region: 'Asia & Pacific', utcOffset: 'UTC+08:45' },
  { value: 'Asia/Chita',              label: 'Yakutsk Time (Chita)',                region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Dili',               label: 'East Timor Time (Dili)',              region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Jayapura',           label: 'Eastern Indonesia Time (Jayapura)',   region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Pyongyang',          label: 'Korea Standard Time (Pyongyang)',     region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Seoul',              label: 'Korea Standard Time (Seoul)',         region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Tokyo',              label: 'Japan Standard Time (Tokyo)',         region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Asia/Yakutsk',            label: 'Yakutsk Time',                        region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Pacific/Palau',           label: 'Palau Time',                          region: 'Asia & Pacific',  utcOffset: 'UTC+09:00' },
  { value: 'Australia/Adelaide',      label: 'Australian Central Time (Adelaide)',  region: 'Asia & Pacific',  utcOffset: 'UTC+09:30' },
  { value: 'Australia/Broken_Hill',   label: 'Australian Central Time (Broken Hill)', region: 'Asia & Pacific', utcOffset: 'UTC+09:30' },
  { value: 'Australia/Darwin',        label: 'Australian Central Time – no DST (Darwin)', region: 'Asia & Pacific', utcOffset: 'UTC+09:30' },
  { value: 'Asia/Vladivostok',        label: 'Vladivostok Time',                    region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Australia/Brisbane',      label: 'Australian Eastern Time – no DST (Brisbane)', region: 'Asia & Pacific', utcOffset: 'UTC+10:00' },
  { value: 'Australia/Hobart',        label: 'Australian Eastern Time (Hobart)',    region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Australia/Melbourne',     label: 'Australian Eastern Time (Melbourne)', region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Australia/Sydney',        label: 'Australian Eastern Time (Sydney)',    region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Pacific/Chuuk',           label: 'Chuuk Time',                          region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Pacific/Guam',            label: 'Chamorro Standard Time (Guam)',       region: 'Asia & Pacific',  utcOffset: 'UTC+10:00' },
  { value: 'Pacific/Port_Moresby',    label: 'Papua New Guinea Time (Port Moresby)', region: 'Asia & Pacific', utcOffset: 'UTC+10:00' },
  { value: 'Australia/Lord_Howe',     label: 'Lord Howe Time',                      region: 'Asia & Pacific',  utcOffset: 'UTC+10:30' },
  { value: 'Asia/Magadan',            label: 'Magadan Time',                        region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Asia/Sakhalin',           label: 'Sakhalin Time',                       region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Pacific/Efate',           label: 'Vanuatu Time (Efate)',                region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Pacific/Guadalcanal',     label: 'Solomon Islands Time (Guadalcanal)',  region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Pacific/Noumea',          label: 'New Caledonia Time (Nouméa)',          region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Pacific/Pohnpei',         label: 'Ponape Time',                         region: 'Asia & Pacific',  utcOffset: 'UTC+11:00' },
  { value: 'Asia/Kamchatka',          label: 'Kamchatka Time',                      region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Auckland',        label: 'New Zealand Time (Auckland)',         region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Fiji',            label: 'Fiji Time',                           region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Funafuti',        label: 'Tuvalu Time (Funafuti)',              region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Kwajalein',       label: 'Marshall Islands Time (Kwajalein)',   region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Majuro',          label: 'Marshall Islands Time (Majuro)',      region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Nauru',           label: 'Nauru Time',                          region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Tarawa',          label: 'Gilbert Islands Time (Tarawa)',       region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Wake',            label: 'Wake Island Time',                    region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Wallis',          label: 'Wallis & Futuna Time',                region: 'Asia & Pacific',  utcOffset: 'UTC+12:00' },
  { value: 'Pacific/Chatham',         label: 'Chatham Islands Time',                region: 'Asia & Pacific',  utcOffset: 'UTC+12:45' },
  { value: 'Pacific/Apia',            label: 'Samoa Time (Apia)',                   region: 'Asia & Pacific',  utcOffset: 'UTC+13:00' },
  { value: 'Pacific/Fakaofo',         label: 'Tokelau Time (Fakaofo)',              region: 'Asia & Pacific',  utcOffset: 'UTC+13:00' },
  { value: 'Pacific/Tongatapu',       label: 'Tonga Time (Tongatapu)',              region: 'Asia & Pacific',  utcOffset: 'UTC+13:00' },
  { value: 'Pacific/Kiritimati',      label: 'Line Islands Time (Kiritimati)',      region: 'Asia & Pacific',  utcOffset: 'UTC+14:00' },
];
