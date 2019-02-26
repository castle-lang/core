import {Context, Expr, Node} from './index';

/** @singletone */
export abstract class Type implements Node {
  public abstract compile(context: Context): string;
}

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

export class IntLiteral extends Literal {
  public readonly value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public compile(context: Context): string { return this.value.toString(); }
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

export class StrLiteral extends Literal {
  private static escapeString(s: string): string {
    return s; // TODO.
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

export const array = (itemType: Type, length: number): Type => new ArrayType(itemType, length);

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

export const slice = (itemType: Type): Type => new SliceType(itemType);

export class RawType extends Type {
  public readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  public compile(_: Context): string { return this.name; }
}

export const str = new StrType();

export const prelude: {[key: string]: Type} = {int, str, ownedStr, auto};
