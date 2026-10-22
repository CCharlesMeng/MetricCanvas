type ChoiceOption = {value:string;label:string};
import { pathToFileURL } from 'node:url';

/** Authoring-only calendar list. The caller supplies the business-local month. */
export function recentMonthOptions(anchor: string): ChoiceOption[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(anchor)) {
    throw new Error('月份锚点必须为 YYYY-MM');
  }
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5));
  const end = year * 12 + month - 1;
  if (year < 1 || end - 11 < 12) throw new Error('月份锚点必须能覆盖此前完整的十二个月');
  return Array.from({ length: 12 }, (_, offset) => {
    const index = end - offset;
    const itemYear = Math.floor(index / 12);
    const itemMonth = index % 12 + 1;
    return {
      value: `${String(itemYear).padStart(4, '0')}${String(itemMonth).padStart(2, '0')}`,
      label: `${itemYear}年${itemMonth}月`
    };
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    console.log(JSON.stringify(recentMonthOptions(process.argv[2] ?? ''), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
