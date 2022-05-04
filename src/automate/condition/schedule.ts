import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

export namespace Predicat {
  export type Predicat = (v: number) => boolean;

  export function eq(ex: number): Predicat {
    return (v: number) => v === ex;
  }

  export function mod(p: Predicat, d: number): Predicat {
    return (v: number) => p(v) && v % d === 0;
  }

  export function seq(min: number, max: number): Predicat {
    return (v: number) => v >= min && v <= max;
  }

  export function or(p: Predicat[]): Predicat {
    return (v: number) => p.reduce((prev: boolean, predicat) => prev || predicat(v), false);
  }

  export function nil(): Predicat {
    return () => true;
  }

  export function convert(template: string): Predicat {
    if (template === '*') {
      return nil();
    }
    if (template.indexOf(',') !== -1) {
      return or(template.split(',').map((subTemplate) => convert(subTemplate.trim())));
    }
    if (template.indexOf('-') !== -1) {
      const [x, y] = template.split('-');
      return seq(parseInt(x.trim(), 10), parseInt(y, 10));
    }
    if (template.indexOf('/') !== -1) {
      const [subTemplate, y] = template.split('/');
      return mod(convert(subTemplate.trim()), parseInt(y.trim(), 10));
    }

    return eq(parseInt(template.trim(), 10));
  }
}

dayjs.extend(utc);
dayjs.extend(timezone);

export interface Params {
  weeks: string;
  months: string;
  days: string;
  hours: string;
  tz?: string;
}

export function paramsVerify(params: any): params is Params {
  const { weeks, months, days, hours, tz } = params;
  if (typeof weeks !== 'string') {
    throw new Error('Invalid weeks');
  }
  if (typeof months !== 'string') {
    throw new Error('Invalid montsh');
  }
  if (typeof days !== 'string') {
    throw new Error('Invalid days');
  }
  if (typeof hours !== 'string') {
    throw new Error('Invalid hours');
  }
  if (typeof tz !== 'string' && tz !== undefined) {
    throw new Error('Invalid timezone');
  }

  return true;
}

export default (params: Params) => {
  const { tz, weeks, months, days, hours } = params;
  const now = dayjs().tz(tz ?? 'UTC');

  const predicats = [
    { v: parseInt(now.format('H'), 10), p: Predicat.convert(hours) },
    { v: parseInt(now.format('D'), 10), p: Predicat.convert(days) },
    { v: parseInt(now.format('M'), 10), p: Predicat.convert(months) },
    { v: parseInt(now.format('d'), 10), p: Predicat.convert(weeks) },
  ];

  return predicats.reduce((prev: boolean, { p, v }) => prev && p(v), true);
};
