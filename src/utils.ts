import * as castle from './index';

export interface Dict<V> {
  [key: string]: V;
}

export const includes = <T>(arr: T[], elem: T): boolean =>
  arr.indexOf(elem) !== -1;

export const compileAll = (
  nodes: castle.Node[],
  context: castle.Context,
): string[] => nodes.map((n) => n.compile(context));

export const copy = (obj: Dict<any>): Dict<any> => {
  const c: Dict<any> = {};

  for (const k in obj) {
    if (obj.hasOwnProperty(k)) {
      c[k] = obj[k];
    }
  }

  return obj;
};

export const extend = (dest: Dict<any>, source: Dict<any>) => {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      dest[key] = source[key];
    }
  }
  return dest;
};
