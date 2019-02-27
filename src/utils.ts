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

export const copy = <T>(obj: Dict<T>): Dict<T> => {
  const objCopy: Dict<T> = {};

  for (const k in obj) {
    if (obj.hasOwnProperty(k)) {
      objCopy[k] = obj[k];
    }
  }

  return objCopy;
};

export const extend = <T>(dest: Dict<T>, source: Dict<T>) => {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      dest[key] = source[key];
    }
  }
  return dest;
};
