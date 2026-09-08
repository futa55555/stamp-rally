// Trip dates are calendar dates, not UTC instants.
export function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function offsetDate(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return localDate(result);
}

export function dateLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

export function dateRange(start: string, end: string): string {
  return `${start.replaceAll('-', '/')} ~ ${end.replaceAll('-', '/')}`;
}

export function timestampLabel(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
