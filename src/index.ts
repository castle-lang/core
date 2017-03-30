import * as types from './types';
import * as lifetimes from './lifetimes';
import {compileAll, copy, extend} from './utils';

declare var module: any;
if (module.exports) {
  module.exports['types'] = types;
  module.exports['lifetimes'] = lifetimes;
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
    readonly target: string;

    /** Typechecker options. */
    readonly typeCheck: CheckInfer<types.Type>;
    /** Borrowchecker options. */
    readonly borrowCheck: CheckInfer<lifetimes.Lifetime>;

    /** Constants that are known in compile-time. */
    constants: {[key: string]: Node} = {
        CASTLE_VERSION: new types.StrLiteral("0.1.0"),
    };

    /** Type aliases. */
    typedefs: {[key: string]: types.Type} = copy(types.prelude);

    /** Verbose option — if set, the code will be commented. */
    readonly verbose: boolean;

    constructor(target: string = "c",
                typeCheck: CheckInfer<types.Type> = defaultCheckInfer,
                borrowCheck: CheckInfer<lifetimes.Lifetime> = defaultCheckInfer,
                constants: {[key: string]: Node} = {},
                typedefs: {[key: string]: types.Type} = {},
                verbose: boolean = true)
    {
        target = target.toLowerCase();
        if (target === 'c++' || target === 'cxx') target = 'cpp';

        this.target = target;
        this.typeCheck = typeCheck;
        this.borrowCheck = borrowCheck;
        extend(this.constants, constants);
        extend(this.typedefs, typedefs);
    }

    getType(type: string): types.Type {
        if (this.typedefs[type] !== undefined) return this.typedefs[type];
        return new types.RawType(type);
    }

    unknownTarget(): never {
        throw new Error(`Unknown target: ${this.target}`);
    }

    unsupportedFeature(feature: string): never {
        throw new Error(`Unsupported feature: ${feature}`);    
    }
}

/**
 * Typechecker/borrowchecker error information.
 */
export type CheckError<T> = {
    readonly lineNumber: number,
    readonly expected: T,
    readonly found: T
}

/**
 * Typechecker/borrowchecker options.
 */
export type CheckInfer<T> = {
    /** Check option — if set, the types/borrows will be checked. */
    readonly check: boolean | ((node: Node, context: Context) => CheckError<T> | null),
    /** Infer option — if set, the types/lifetimes will be inferred. */
    readonly infer: boolean | ((node: Node, context: Context) => T),
}

const defaultCheckInfer = {check: false, infer: false};

export abstract class Stmt implements Node {
    abstract compile(context: Context): string;
}

export abstract class Expr extends Stmt {}

export abstract class Def implements Node {
    abstract compile(context: Context): string;
}

/** Pattern — can be used in assignments, match statements etc. */
export interface Pat extends Node {
    match(expr: Expr, context: Context): {[key: string]: Expr};
}

export class Module extends Def {
    /** Module-level definitions. */
    readonly defs: Def[];

    constructor(defs: Def[]) {
        super();
        this.defs = defs;
    }

    // TODO: check and infer types and lifetimes
    compile(context: Context): string {
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

export class Block extends Expr {
    readonly stmts: Stmt[];

    constructor(stmts: Stmt[]) {
        super();
        this.stmts = stmts;
    }

    compile(context: Context): string {
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
export class Extern extends Def implements Callable<FnCall> {
    /** Function name. */
    readonly name: string;
    /** Function arguments. */
    readonly args: Arg[];
    /** Function return type. */
    readonly ret: types.Type | string;
    
    constructor(name: string, args: Arg[], ret: types.Type | string) {
        super();
        this.name = name;
        this.args = args;
        this.ret = ret;
    }
    
    compile(context: Context): string {
        const ret_ = (typeof this.ret === 'string') ? context.getType(this.ret) : this.ret as types.Type;
        let ret, args;
        switch (context.target) {
            case 'c':
            case 'cpp':
                ret = ret_.compile(context);
                args = compileAll(this.args, context);
                return `${ret} ${this.name}(${args.join(', ')});`;
            case 'rust':
                return context.unsupportedFeature('function extern');
            default:
                return context.unknownTarget();
        }
    }
    
    callOp(args: Expr[]): FnCall {
        return new FnCall(this, args);
    }
}

/**
 * Castle function definition (with implementation).
 */
export class Define extends Def implements Callable<FnCall> {
    /** Function name. */
    readonly name: string;
    /** Function arguments. */
    readonly args: Arg[];
    /** Function return type. */
    readonly ret: types.Type | string;
    /** Function body. */
    readonly body: Block;
    
    constructor(name: string, args: Arg[], ret: types.Type | string, body: Block) {
        super();
        this.name = name;
        this.args = args;
        this.body = body;
        this.ret = ret;
    }
    
    compile(context: Context): string {
        const ret_ = (typeof this.ret === 'string') ? context.getType(this.ret) : this.ret as types.Type;
        let ret, args, body;
        switch (context.target) {
            case 'c':
            case 'cpp':
                ret = ret_.compile(context);
                args = compileAll(this.args, context).join(', ');
                return `${ret} ${this.name}(${args}) ${this.body.compile(context)}`;
            case 'rust':
                return context.unsupportedFeature('function extern');
            default:
                return context.unknownTarget();
        }
    }
    
    callOp(args: Expr[]): FnCall {
        return new FnCall(this, args);
    }
}

export class FnCall extends Expr {
    readonly fn: Extern | Define | string;
    readonly args: Expr[];
    
    constructor(fn: Extern | Define | string, args: Expr[]) {
        super();
        this.fn = fn;
        this.args = args;
    }
    
    compile(context: Context): string {
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
    readonly name: string;
    readonly type: types.Type | string;
    
    constructor(name: string, type: types.Type | string = types.auto) {
        this.name = name;
        this.type = type;
    }
    
    compile(context: Context): string {
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

export class Return extends Stmt {
    readonly value: Expr;

    constructor(value: Expr) {
        super();
        this.value = value;
    }

    compile(context: Context): string {
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

export class Declare extends Stmt {
    readonly name: string;
    readonly type: types.Type | null;
    readonly init: Expr | null;

    constructor(name: string, type: types.Type | null, init: Expr | null) {
        super();
        this.name = name;
        this.type = type;
        this.init = init;
    }

    compile(context: Context): string {
        if (this.init === null && this.type === null) {
            throw new Error('cannot declare a variable without type and initial value');
        }

        throw new Error('TODO: implement variable declaration');
    }
}

export class Assign extends Stmt {
    readonly lvalue: Pat;
    readonly rvalue: Expr;

    constructor(lvalue: Pat, rvalue: Expr) {
        super();
        this.lvalue = lvalue;
        this.rvalue = rvalue;
    }

    compile(context: Context): string {
        switch (context.target) {
            case 'c':
            case 'cpp':
            case 'rust':
                return `${this.lvalue.compile(context)} = ${this.rvalue.compile(context)}`;
            default:
                return context.unknownTarget();
        }
    }
}

export class Var extends Expr implements Pat {
    readonly name: string;
    readonly type: types.Type | null;

    constructor(name: string, type: types.Type | null = null) {
        super();
        this.name = name;
        this.type = type;
    }

    compile(context: Context): string {
        return this.name;
    }
    
    match(expr: Expr, _: Context): {[key: string]: Expr} {
        return {[this.name]: expr};
    }
}

export class IfElse extends Stmt {
    readonly cases: { cond: Expr, body: Block }[];
    readonly defaultCase: Block | null;

    constructor(cases: { cond: Expr, body: Block }[], defaultCase: Block | null) {
        super();
        this.cases = cases;
        this.defaultCase = defaultCase;
    }

    compile(context: Context): string {
        let ret = '';
        switch (context.target) {
            case 'c':
            case 'cpp':
                ret += 'if ' + this.cases.map(c => {
                    return `(${c.cond.compile(context)}) ${c.body.compile(context)}`;
                }).join(' else if ');
                if (this.defaultCase !== null) {
                    ret += ` else ${(this.defaultCase as Block).compile(context)}`;
                }
                return ret;
            case 'rust':
                return context.unsupportedFeature('if-else statements');
            default:
                return context.unknownTarget();
        }
    }
}

export class While extends Stmt {
    readonly cond: Expr;
    readonly body: Block;

    constructor(cond: Expr, body: Block) {
        super();
        this.cond = cond;
        this.body = body;
    }

    compile(context: Context): string {
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

export class For extends Stmt {
    readonly init: Stmt;
    readonly cond: Expr;
    readonly next: Stmt;
    readonly body: Block;

    constructor(init: Stmt, cond: Expr, next: Stmt, body: Block) {
        super();
        this.init = init;
        this.cond = cond;
        this.next = next;
        this.body = body;
    }

    compile(context: Context): string {
        switch (context.target) {
            case 'c':
            case 'cpp':
                return `for (${this.init.compile(context)}; ${this.cond.compile(context)}; ${this.next.compile(context)}) ${this.body.compile(context)}`;
            case 'rust':
                return context.unsupportedFeature('for loops');
            default:
                return context.unknownTarget();
        }
    }
}
