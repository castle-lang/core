/**
 * This module contains declaration of classes that represent types and literal
 * expressions.
 */

import {Context, Expr, Node} from './index';

/** @singletone */
export abstract class Type implements Node {
  public abstract compile(context: Context): string;
}

/**
 * Type-level value.
 */
type Generic = Type | number | ((t: Generic) => Generic);

export abstract class Literal implements Node {
  public abstract compile(context: Context): string;
}

/**
 * Inferred type.
 * @singletone
 */
export class AutoType extends Type {
  public compile(context: Context): string {
    if (context.target === 'cpp') {
      return 'auto'; // TODO: type infer for auto type
    }
    return context.unsupportedFeature('type infer');
  }
}

export const auto = new AutoType();

export class BoolLiteral extends Literal {
  public value: boolean;

  public constructor(value: boolean) {
    super();
    this.value = value;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
        return this.value ? '1' : '0';
      case 'c++':
      case 'rust':
        return this.value.toString();
      default:
        return context.unknownTarget();
    }
  }
}

export class BoolType extends Type {
  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
        return 'int';
      case 'c++':
      case 'rust':
        return 'bool';
      default:
        return context.unknownTarget();
    }
  }
}

export class IntLiteral extends Literal {
  public readonly value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public compile(context: Context): string {
    return Math.floor(this.value).toString();
  }
}

/** @singletone */
export class IntType extends Type {
  public compile(context: Context): string {
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

export class FloatLiteral extends Literal {
  public readonly value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public compile(context: Context): string {
    let s = this.value.toString();
    if (s.indexOf('.') === -1) {
      s += '.0';
    }
    return s;
  }
}

/** @singletone */
export class FloatType extends Type {
  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'c++':
        return 'float';
      case 'rust':
        return 'f32';
      default:
        return context.unknownTarget();
    }
  }
}

export const float = new FloatType();

export class StrLiteral extends Literal {
  private static escapeString(s: string): string {
    let result = '';
    for (const c of s) {
      switch (c) {
        case '"':
          result += '\\"';
          break;
        case '\n':
          result += '\\n';
          break;
        case '\t':
          result += '\\t';
          break;
        default:
          result += c;
          break;
      }
    }
    return result;
  }

  public readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  public compile(context: Context): string {
    return `"${StrLiteral.escapeString(this.value)}"`;
  }
}

/** @singletone */
export class StrType extends Type {
  public compile(context: Context): string {
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

/** @singletone */
export class OwnedStrType extends Type {
  public compile(context: Context): string {
    switch (context.target) {
      case 'rust':
        return 'String';
      case 'c':
      case 'c++':
        return context.unsupportedFeature('owned string type');
      default:
        return context.unknownTarget();
    }
  }
}

export const ownedStr = new OwnedStrType();

export class ArrayLiteral extends Literal {
  public elements: Expr[];

  constructor(elements: Expr[]) {
    super();
    this.elements = elements;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'c++':
      case 'rust':
        return `[${this.elements.map((e: Expr) => e.compile(context)).join(', ')}]`;
      default:
        return context.unknownTarget();
    }
  }
}

export class ArrayType extends Type {
  public readonly itemType: Type;
  public readonly length: number;

  public constructor(itemType: Type, length: number) {
    super();
    this.itemType = itemType;
    this.length = length;
  }

  public compile(context: Context): string {
    const itemType = this.itemType.compile(context);

    switch (context.target) {
      case 'c':
        return `*${itemType}`;
      case 'c++':
        return `${itemType}[]`;
      case 'rust':
        return `[${itemType}; ${this.length}]`;
      default:
        return context.unknownTarget();
    }
  }
}

export const array: Generic = (itemType: Type) => (length: number) => new ArrayType(itemType, length);

export class SliceType extends Type {
  public readonly itemType: Type;

  public constructor(itemType: Type) {
    super();
    this.itemType = itemType;
  }

  public compile(context: Context): string {
    const itemType = this.itemType.compile(context);

    switch (context.target) {
      case 'c':
        return `*${itemType}`;
      case 'c++':
        return `${itemType}[]`;
      case 'rust':
        return `&[${itemType}]`;
      default:
        return context.unknownTarget();
    }
  }
}

export const slice: Generic = (itemType: Type): Type => new SliceType(itemType);

export class NamedStructLiteral extends Literal {
  public readonly name: string;
  public readonly contents: StructLiteral;

  public constructor(name: string, contents: {[key: string]: Expr} | StructLiteral) {
    super();
    this.name = name;
    this.contents = (contents instanceof StructLiteral) ? contents : new StructLiteral(contents);
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'c++':
        return context.unsupportedFeature('named struct literal');
      case 'rust':
        return `${this.name} ${this.contents.compile(context)}`;
      default:
        return context.unknownTarget();
    }
  }
}

export class StructLiteral extends Literal {
  public readonly contents: {[key: string]: Expr};

  public constructor(contents: {[key: string]: Expr}) {
    super();
    this.contents = contents;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'c++':
        return context.unsupportedFeature('struct literal');
      case 'rust':
        return Object.keys(this.contents).map((k: string) => `${k}: ${this.contents[k]},`).join('\n');
      default:
        return context.unknownTarget();
    }
  }
}

export class RawType extends Type {
  public readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  public compile(_: Context): string { return this.name; }
}

export const raw = (name: string): Type => new RawType(name);

export const str = new StrType();

export const prelude: {[key: string]: Type} = {int, str, ownedStr, auto};
