import * as types from './types';

import {compileAll, copy, extend} from './utils';

declare const module: any;
if (module.exports) {
  module.exports.types = types;
}

/**
 * Castle AST node.
 */
export interface Node {
  /**
   * Generates target code.
   * @param {Context} context - The Castle compilation context.
   * @return {string} The generated code.
   */
  compile(context: Context): string;
}

/**
 * Callable value.
 */
export interface Callable<T> {
  /**
   * Represents call operator invokation.
   * @param {Expr[]} args - Arguments that are passed to a callable.
   * @returns {T} AST node that represents call operator invokation.
   */
  callOp(args: Expr[]): T;
}

/**
 * Castle compilation context.
 */
export class Context {
  /** Compilation target. */
  public readonly target: string;

  /** Constants that are known in compile-time. */
  public constants: {[key: string]: Node} = {
    CASTLE_VERSION: new types.StrLiteral('0.2.1'),
  };

  /** Type aliases. */
  public typedefs: {[key: string]: types.Type} = copy(types.prelude);

  /** Verbose option - if set, the code will be commented. */
  public readonly verbose: boolean;

  constructor(
    target: string = 'c',
    constants: {[key: string]: Node} = {},
    typedefs: {[key: string]: types.Type} = {},
    verbose: boolean = true,
  ) {
    target = target.toLowerCase();
    if (target === 'c++' || target === 'cxx') {
      target = 'cpp';
    }

    this.target = target;
    extend(this.constants, constants);
    extend(this.typedefs, typedefs);
  }

  public clone(): Context {
    return new Context(
      this.target,
      this.constants,
      this.typedefs,
      this.verbose,
    );
  }

  public getType(type: string): types.Type {
    if (this.typedefs[type] !== undefined) {
      return this.typedefs[type];
    }
    return new types.RawType(type);
  }

  public unknownTarget(): never {
    throw new Error(`Unknown target: ${this.target}`);
  }

  public unsupportedFeature(feature: string): never {
    throw new Error(`Unsupported feature: ${feature}`);
  }
}

export interface Stmt extends Node {}
export interface Expr extends Stmt {}
export interface Def extends Node {}

/** Pattern - can be used in assignments, match statements etc. */
export interface Pat extends Node {
  match(expr: Expr, context: Context): Match;
}

export interface Match {
  stmts: Stmt[];
  assigns: MatchAssign[];
}

export interface MatchAssign {
  name: string;
  value: Expr;
}

export class Module implements Def {
  /** Module-level definitions. */
  public readonly defs: Def[];

  constructor(defs: Def[]) {
    this.defs = defs;
  }

  // TODO: check and infer types and lifetimes
  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
      case 'rust':
        return compileAll(this.defs, context).join('\n\n');
      default:
        return context.unknownTarget();
    }
  }
}

export class Block implements Expr {
  public readonly stmts: Stmt[];

  constructor(stmts: Stmt[]) {
    this.stmts = stmts;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
      case 'rust':
        const body = compileAll(this.stmts, context)
          .map((c: string) => c + ';')
          .join('\n');
        return `{\n${body}\n}`;
      default:
        return context.unknownTarget();
    }
  }
}

/**
 * Castle function declaration (without implementation).
 */
export class Extern implements Def, Callable<FnCall> {
  /** Function name. */
  public readonly name: string;
  /** Function arguments. */
  public readonly args: Arg[];
  /** Function return type. */
  public readonly ret: types.Type | string;

  constructor(name: string, args: Arg[], ret: types.Type | string) {
    this.name = name;
    this.args = args;
    this.ret = ret;
  }

  public compile(context: Context): string {
    const ret = (typeof this.ret === 'string') ? context.getType(this.ret) : this.ret as types.Type;
    const retCompiled = ret.compile(context);
    const args = compileAll(this.args, context);

    switch (context.target) {
      case 'c':
      case 'cpp':
        return `${retCompiled} ${this.name}(${args.join(', ')});`;
      case 'rust':
        return context.unsupportedFeature('function extern');
      default:
        return context.unknownTarget();
    }
  }

  public callOp(args: Expr[]): FnCall {
    return new FnCall(this, args);
  }
}

/**
 * Castle function definition (with implementation).
 */
export class Define implements Def, Callable<FnCall> {
  /** Function name. */
  public readonly name: string;
  /** Function arguments. */
  public readonly args: Arg[];
  /** Function return type. */
  public readonly ret: types.Type | string;
  /** Function body. */
  public readonly body: Block;

  constructor(name: string, args: Arg[], ret: types.Type | string, body: Block) {
    this.name = name;
    this.args = args;
    this.body = body;
    this.ret = ret;
  }

  public compile(context: Context): string {
    const ret = (typeof this.ret === 'string')
      ? context.getType(this.ret)
      : this.ret as types.Type;
    const retCompiled = ret.compile(context);
    const args = compileAll(this.args, context).join(', ');
    const body = this.body.compile(context);

    switch (context.target) {
      case 'c':
      case 'cpp':
        return `${retCompiled} ${this.name}(${args}) ${body}`;
      case 'rust':
        // TODO: should all functions be public?
        return `fn ${this.name}(${args}) -> ${retCompiled} ${body}`;
      default:
        return context.unknownTarget();
    }
  }

  public callOp(args: Expr[]): FnCall {
    return new FnCall(this, args);
  }
}

export class FnCall implements Expr {
  public readonly fn: Extern | Define | string;
  public readonly args: Expr[];

  constructor(fn: Extern | Define | string, args: Expr[]) {
    this.fn = fn;
    this.args = args;
  }

  public compile(context: Context): string {
    let fn;
    if (typeof this.fn === 'string') {
      fn = this.fn;
    } else {
      fn = (this.fn as Extern | Define).name;
    }
    const args = compileAll(this.args, context);
    return `${fn}(${args.join(', ')})`;
  }
}

export class Arg implements Node {
  public readonly name: string;
  public readonly type: types.Type | string;

  constructor(name: string, type: types.Type | string = types.auto) {
    this.name = name;
    this.type = type;
  }

  public compile(context: Context): string {
    let type;

    if (typeof this.type === 'string') {
      type = this.type;
    } else {
      type = (this.type as types.Type).compile(context);
    }

    switch (context.target) {
      case 'c':
      case 'cpp':
        return `${type} ${this.name}`;
      case 'rust':
        return `${this.name}: ${type}`;
      default:
        return context.unknownTarget();
    }
  }
}

export class Return implements Stmt {
  public readonly value: Expr;

  constructor(value: Expr) {
    this.value = value;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
      case 'rust':
        return `return ${this.value.compile(context)}`;
      default:
        return context.unknownTarget();
    }
  }
}

export class Declare implements Stmt {
  public readonly name: string;
  public readonly type: types.Type | null;
  public readonly init: Expr | null;

  constructor(name: string, type: types.Type | null, init: Expr | null) {
    this.name = name;
    this.type = type;
    this.init = init;
  }

  public compile(context: Context): string {
    if (this.init === null && this.type === null) {
      throw new Error('cannot declare a variable without type and initial value');
    }

    throw new Error('TODO: implement variable declaration');
  }
}

export class Assign implements Stmt {
  public readonly lvalue: Pat;
  public readonly rvalue: Expr;

  constructor(lvalue: Pat, rvalue: Expr) {
    this.lvalue = lvalue;
    this.rvalue = rvalue;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
      case 'rust':
        const match = this.lvalue.match(this.rvalue, context);
        const stmts = match.stmts.map((s: Stmt) => s.compile).join('\n');
        const assigns = match
          .assigns
          .map((m: MatchAssign) => `${m.name} = ${m.value.compile(context)};`)
          .join('\n');
        return `${stmts}\n${assigns}`;
      default:
        return context.unknownTarget();
    }
  }
}

export class Var implements Expr, Pat {
  public readonly name: string;
  public readonly type: types.Type | null;

  constructor(name: string, type: types.Type | null = null) {
    this.name = name;
    this.type = type;
  }

  public compile(context: Context): string {
    return this.name;
  }

  public match(expr: Expr, _: Context): Match {
    return {
      assigns: [ { name: this.name, value: expr } ],
      stmts: [],
    };
  }
}

export interface IfBranch {
  cond: Expr;
  body: Block;
}

export class IfElse implements Stmt {
  public readonly cases: IfBranch[];
  public readonly defaultCase: Block | null;

  constructor(cases: IfBranch[], defaultCase: Block | null) {
    this.cases = cases;
    this.defaultCase = defaultCase;
  }

  public compile(context: Context): string {
    let ret = '';
    switch (context.target) {
      case 'c':
      case 'cpp':
        ret += 'if ' + this.cases.map((c) => {
          return `(${c.cond.compile(context)}) ${c.body.compile(context)}`;
        }).join(' else if ');
        if (this.defaultCase !== null) {
          ret += ` else ${(this.defaultCase as Block).compile(context)}`;
        }
        return ret;
      case 'rust':
        ret += 'if ' + this.cases.map((c) => {
          return `${c.cond.compile(context)} ${c.body.compile(context)}`;
        }).join(' else if ');
        if (this.defaultCase !== null) {
          ret += ` else ${(this.defaultCase as Block).compile(context)}`;
        }
        return ret;
      default:
        return context.unknownTarget();
    }
  }
}

export class While implements Stmt {
  public readonly cond: Expr;
  public readonly body: Block;

  constructor(cond: Expr, body: Block) {
    this.cond = cond;
    this.body = body;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
        return `while (${this.cond.compile(context)}) ${this.body.compile(context)}`;
      case 'rust':
        return `while ${this.cond.compile(context)} ${this.body.compile(context)}`;
      default:
        return context.unknownTarget();
    }
  }
}

export class For implements Stmt {
  public readonly init: Stmt;
  public readonly cond: Expr;
  public readonly next: Stmt;
  public readonly body: Block;

  constructor(init: Stmt, cond: Expr, next: Stmt, body: Block) {
    this.init = init;
    this.cond = cond;
    this.next = next;
    this.body = body;
  }

  public compile(context: Context): string {
    const [init, cond, next, body] =
      [this.init, this.cond, this.next, this.body].map(
        (x) => x.compile(context),
      );
    switch (context.target) {
      case 'c':
      case 'cpp':
        return `for (${init}; ${cond}; ${next}) ${body}`;
      case 'rust':
        return context.unsupportedFeature('for loops');
      default:
        return context.unknownTarget();
    }
  }
}

export class Loop implements Stmt {
  public readonly body: Block;

  constructor(body: Block) {
    this.body = body;
  }

  public compile(context: Context): string {
    switch (context.target) {
      case 'c':
      case 'cpp':
        return `while (1) ${this.body.compile(context)}`;
      case 'rust':
        return `loop ${this.body.compile(context)}`;
      default:
        return context.unknownTarget();
    }
  }
}
