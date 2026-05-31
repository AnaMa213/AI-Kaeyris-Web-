/**
 * Parse a datetime string returned by the backend.
 *
 * The backend currently serialises timestamps as naive ISO strings without a
 * timezone suffix (e.g. `"2026-05-31T18:00:00"`). JavaScript's `Date`
 * constructor interprets such strings as **local time**, which silently
 * shifts the value by the machine's UTC offset.
 *
 * This helper forces UTC interpretation by appending `Z` when no timezone is
 * present. Strings that already carry `Z` or a `±HH:MM` offset pass through
 * untouched.
 *
 * Track BD-fix at `docs/backend-handoffs/BD-5-tz-suffix.md` (frontend
 * workaround can be removed once the backend serialises with explicit UTC).
 */
export function parseBackendDate(value: string): Date {
  if (/[Zz]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(`${value}Z`);
}
