import * as castle from './index';

export interface Dict<V> {
  [key: string]: V;
}

function includes<T>(arr: T[], elem: T): boolean {
  return arr.indexOf(elem) !== -1;
}

export function compileAll(nodes: castle.Node[], context: castle.Context): string[] {
  return nodes.map((n) => n.compile(context));
}

export function copy(obj: Dict<any>): Dict<any> {
  const c: Dict<any> = {};

  for (const k in obj) {
    if (obj.hasOwnProperty(k)) {
      c[k] = obj[k];
    }
  }

  return obj;
}

export function extend(dest: Dict<any>, source: Dict<any>) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      dest[key] = source[key];
    }
  }
  return dest;
}
