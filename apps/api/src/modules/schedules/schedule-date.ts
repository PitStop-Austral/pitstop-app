const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function argentinaDate(value = new Date()): Date {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return new Date(`${date}T00:00:00.000Z`);
}

export function argentinaDateToday(): Date {
  return argentinaDate();
}
