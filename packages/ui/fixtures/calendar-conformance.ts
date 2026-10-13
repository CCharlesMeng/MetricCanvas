export const calendarConformance = [
  ['month', '0000-01', false], ['month', '0001-01', true], ['month', '9999-12', true],
  ['month', '2026-00', false], ['month', '2026-13', false], ['month', '2026-1', false],
  ['date', '1900-02-29', false], ['date', '2000-02-29', true], ['date', '2024-02-29', true],
  ['date', '2026-02-29', false], ['date', '2026-04-31', false], ['date', '0001-01-01', true],
  ['date', '9999-12-31', true], ['date', '2026-01-01T00:00', false], ['date', '2026-1-01', false]
] as const;
