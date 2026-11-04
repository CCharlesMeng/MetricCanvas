/** Authoring evaluation context. Never persisted in the page document. */
export interface TemporalEvaluation { instant: string; timeZone: string }

function validInstant(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const calendar = new Date(0);
  const [year, month, day] = match.slice(1).map(Number);
  calendar.setUTCFullYear(year!, month! - 1, day);
  return year! >= 1 && calendar.getUTCFullYear() === year && calendar.getUTCMonth() + 1 === month && calendar.getUTCDate() === day;
}

/** Validate explicit values without consulting the process clock or time zone. */
export function temporalEvaluationIssue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Evaluation context must contain instant and IANA timeZone';
  const context = value as Record<string, unknown>;
  if (Object.keys(context).some(key => key !== 'instant' && key !== 'timeZone')) return 'Unknown evaluation context field';
  if (typeof context.instant !== 'string' || !validInstant(context.instant)) return 'Evaluation instant must be a valid ISO timestamp with offset';
  if (typeof context.timeZone !== 'string' || !/^(?:UTC|GMT|[A-Za-z_]+(?:\/[A-Za-z0-9_+.\-]+)+)$/.test(context.timeZone)) return 'Evaluation timeZone must be an IANA zone';
  try { evaluationTimeValue('datetime', context as unknown as TemporalEvaluation); }
  catch { return 'Evaluation timeZone is unavailable or the local calendar is out of range'; }
  return undefined;
}

/** Gregorian wall-calendar value at an explicit instant in an explicit business zone. */
export function evaluationTimeValue(precision: 'month' | 'date' | 'datetime', evaluation: TemporalEvaluation): string {
  const parts = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
    timeZone: evaluation.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', era: 'short'
  }).formatToParts(new Date(evaluation.instant));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  if (values.era !== 'AD' || Number(values.year) > 9999) throw Error('Evaluation calendar is out of range');
  const month = `${values.year!.padStart(4, '0')}-${values.month}`;
  if (precision === 'month') return month;
  const date = `${month}-${values.day}`;
  return precision === 'datetime' ? `${date}T${values.hour}:${values.minute}` : date;
}
