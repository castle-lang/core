import {Node, Context} from './index';

/** @singletone */
export abstract class Type implements Node {
    abstract compile(context: Context): string;
}

export abstract class Literal implements Node {
    abstract compile(context: Context): string;
}

/**
 * Inferred type.
 * @singletone
 */
export class AutoType extends Type {
    compile(context: Context): string {
        if (context.target === 'cpp') {
            return 'auto';  // TODO: type infer for auto type
        }
        return context.unsupportedFeature('type infer');
    }
}

export const auto = new AutoType();

export class IntLiteral extends Literal {
    readonly value: number;
    
    constructor(value: number) {
        super();
        this.value = value;
    }
    
    compile(context: Context): string {
        return this.value.toString();
    }
}

/** @singletone */
export class IntType extends Type {
    compile(context: Context): string {
        switch (context.target) {
            case 'c':
            case 'c++':
                return 'int';
            case 'rust':
                return 'i32';
            default:
                return context.unknownTarget();
        }
    }
}

export const int = new IntType();

export class StrLiteral extends Literal {
    readonly value: string;
    
    constructor(value: string) {
        super();
        this.value = value;
    }
    
    compile(context: Context): string {
        return `"${this.value}"`;   // TODO: escape special characters
    }
}

/** @singletone */
export class StrType extends Type {
    compile(context: Context): string {
        switch (context.target) {
            case 'c':
                return 'char*';
            case 'c++':
                return 'string';
            case 'rust':
                return '&str';
            default:
                return context.unknownTarget();
        }
    }
}

export class RawType extends Type {
    readonly name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    compile(_: Context): string {
        return this.name;
    }
}

export const str = new StrType();

export const prelude: {[key: string]: Type} = {int, str, auto};