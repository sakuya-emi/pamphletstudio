// Calendar dates are interpreted independently of the device's time zone.
export function festivalDate(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d{4})(?:年|-|\/)(\d{1,2})(?:月|-|\/)(\d{1,2})(?:日)?(?:[（(][日月火水木金土][）)])?$/,
    );
  if (!match) return;
  const [, y, m, d] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  if (year < 1000) return;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return;
  return {
    year,
    coverLabel: `${year}.${m.padStart(2, "0")}.${d.padStart(2, "0")} ${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()]}`,
    label: `${year}年${month}月${day}日（${"日月火水木金土"[date.getUTCDay()]}）`,
  };
}
