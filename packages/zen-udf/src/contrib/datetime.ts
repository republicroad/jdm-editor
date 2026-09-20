// dt 域：时区转换（Intl IANA）+ 营业日（节假日表=数据参数）+ 日期差。
// 无 "now"——一切从输入出发，保证可重放。纯函数、零出网。
import { defineContrib, defineTool } from '../register.ts';

type Calendar = { holidays?: string[]; workdays?: string[]; weekend?: number[] };
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const parseDate = (s: string): Date | null => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const addDays = (iso: string, n: number): string => {
  const d = parseDate(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
};
const isBusinessDay = (iso: string, cal: Calendar): boolean => {
  if (cal.holidays?.includes(iso)) return false;
  if (cal.workdays?.includes(iso)) return true;
  return !(cal.weekend ?? [0, 6]).includes(parseDate(iso)!.getUTCDay());
};

export const dt_convert = defineTool({
  name: 'convert',
  description: '将 ISO 8601 瞬时转换为目标 IANA 时区的挂钟表示（Intl，DST 正确）。非法时区返回结构化错误。',
  parametersSchema: {
    properties: {
      datetime: { type: 'string', title: 'Datetime', description: 'ISO 8601 瞬时（含偏移或 Z）' },
      to: { type: 'string', title: 'To', description: 'IANA 时区（如 Asia/Shanghai）' },
    },
    required: ['datetime', 'to'],
    title: 'dt_convert',
    type: 'object',
  },
  returnsSchema: { type: 'object', title: 'dt_convert 函数返回', properties: {} },
  fn: (kwargs: Record<string, unknown>) => {
    const zone = String(kwargs?.to ?? '');
    const instant = new Date(String(kwargs?.datetime ?? ''));
    if (Number.isNaN(instant.getTime())) return { datetime: null, error: 'INVALID_DATE' };
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(instant);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
      return {
        datetime: `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`,
        zone,
      };
    } catch {
      return { datetime: null, error: 'INVALID_TIMEZONE' };
    }
  },
});

export const dt_business_day = defineTool({
  name: 'business_day',
  description:
    '营业日推算：op=is_business_day/add_business_days/business_days_between/next_business_day。' +
    'calendar={holidays[],workdays[],weekend?[0,6]} 为数据参数（判定优先级 假日>补班>周末）；' +
    '不传 calendar = 纯周末模式（中国调休场景必须传）。区间上限 3 年。',
  parametersSchema: {
    properties: {
      date: { type: 'string', title: 'Date', description: 'YYYY-MM-DD' },
      op: {
        type: 'string',
        title: 'Op',
        description: 'is_business_day / add_business_days / business_days_between / next_business_day',
      },
      days: { type: 'integer', title: 'Days', description: 'add/between 的天数' },
      to: { type: 'string', title: 'To', description: 'between 的结束日期 YYYY-MM-DD' },
      calendar: {
        type: 'object',
        title: 'Calendar',
        description: '{ holidays[], workdays[], weekend?[0,6] }——节假日表是数据，随国务院安排每年更新',
        default: null,
      },
    },
    required: ['date', 'op'],
    title: 'dt_business_day',
    type: 'object',
  },
  returnsSchema: { type: 'object', title: 'dt_business_day 函数返回', properties: {} },
  fn: (kwargs: Record<string, unknown>) => {
    const date = String(kwargs?.date ?? '');
    const op = String(kwargs?.op ?? '');
    const cal = (kwargs?.calendar ?? {}) as Calendar;
    if (!parseDate(date)) return { error: 'INVALID_DATE' };
    const business = (iso: string) => isBusinessDay(iso, cal);
    if (op === 'is_business_day') return { business: business(date) };
    if (op === 'next_business_day') {
      let cursor = addDays(date, 1);
      for (let i = 0; i < 1100 && !business(cursor); i += 1) cursor = addDays(cursor, 1);
      return { date: cursor, business: business(cursor) };
    }
    if (op === 'add_business_days') {
      const n = Number(kwargs?.days ?? 0);
      if (!Number.isInteger(n)) return { error: 'INVALID_DATE' };
      let cursor = date;
      let step = 0;
      const target = Math.abs(n);
      const dir = n < 0 ? -1 : 1;
      while (step < target) {
        cursor = addDays(cursor, dir);
        if (business(cursor)) step += 1;
      }
      return { date: cursor };
    }
    if (op === 'business_days_between') {
      const to = String(kwargs?.to ?? '');
      if (!parseDate(to)) return { error: 'INVALID_DATE' };
      let count = 0;
      let cursor = date < to ? date : to;
      const end = date < to ? to : date;
      while (cursor <= end && count <= 1100) {
        if (business(cursor)) count += 1;
        cursor = addDays(cursor, 1);
      }
      return { count };
    }
    return { error: 'UNKNOWN_OP' };
  },
});

export const dt_diff = defineTool({
  name: 'diff',
  description:
    '日期差：unit=days（日历日）/ business_days（需 calendar）/ months（月末日钳制）。inclusive 缺省 false。',
  parametersSchema: {
    properties: {
      from: { type: 'string', title: 'From', description: 'YYYY-MM-DD' },
      to: { type: 'string', title: 'To', description: 'YYYY-MM-DD' },
      unit: { type: 'string', title: 'Unit', description: 'days / business_days / months', default: 'days' },
      calendar: { type: 'object', title: 'Calendar', default: null },
      inclusive: { type: 'boolean', title: 'Inclusive', default: false },
    },
    required: ['from', 'to'],
    title: 'dt_diff',
    type: 'object',
  },
  returnsSchema: { type: 'object', title: 'dt_diff 函数返回', properties: {} },
  fn: (kwargs: Record<string, unknown>) => {
    const from = parseDate(String(kwargs?.from ?? ''));
    const to = parseDate(String(kwargs?.to ?? ''));
    if (!from || !to) return { error: 'INVALID_DATE' };
    const unit = String(kwargs?.unit ?? 'days');
    if (unit === 'business_days') {
      const cal = (kwargs?.calendar ?? {}) as Calendar;
      const inclusive = kwargs?.inclusive === true;
      let count = 0;
      let cursor = (from <= to ? from : to).toISOString().slice(0, 10);
      const end = (from <= to ? to : from).toISOString().slice(0, 10);
      while (count <= 1100) {
        if (isBusinessDay(cursor, cal)) count += 1;
        if (cursor === end) break;
        cursor = addDays(cursor, 1);
      }
      if (count > 1100) return { error: 'RANGE_TOO_LARGE' };
      return {
        count: inclusive ? count : Math.max(0, count - (isBusinessDay(from.toISOString().slice(0, 10), cal) ? 1 : 0)),
      };
    }
    if (unit === 'months') {
      let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
      if (to.getUTCDate() < from.getUTCDate()) months -= 1;
      return { count: Math.abs(months) };
    }
    const days = Math.abs((to.getTime() - from.getTime()) / 86400000);
    return { count: Math.round(days) };
  },
});

export const tools = [dt_convert, dt_business_day, dt_diff];

export default defineContrib(import.meta.url, {
  tools,
});
