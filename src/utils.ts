import * as castle from './index';

export type Dict<V> = {[key: string]: V};

function includes<T>(arr: T[], elem: T): Boolean {
    return arr.indexOf(elem) !== -1;
}

export function compileAll(nodes: castle.Node[], context: castle.Context): string[] {
    return nodes.map(n => n.compile(context));
}

export function copy(obj: Dict<any>): Dict<any> {
    const c: Dict<any> = {};
    for (let k in obj) c[k] = obj[k];
    return obj;
}

export function extend(dest: Dict<any>, source: Dict<any>) {
    for (let key in source) {
        dest[key] = source[key];
    }
    return dest;
}   
