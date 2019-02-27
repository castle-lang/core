const {assert} = require('chai');
const castle = require('..');
const types = castle.types;

describe('C target', () => {
    const context = new castle.Context();
    
    const puts = new castle.Extern('puts',
        [new castle.Arg('s', types.str)], 
        types.int
    );
    
    const main = new castle.Define('main', [], types.int, new castle.Block([
        puts.callOp([new types.StrLiteral('Hello, world!')]),
        new castle.Return(new types.IntLiteral(0))
    ]));

    it('should print empty module', () => {
        const m = new castle.Module([]);
        assert.equal(m.compile(context), '');
    });
    
    it('should print function declaration', () => {
        assert.equal(puts.compile(context), 'int puts(char* s);');
    });
    
    it('should print function call', () => {
        assert.equal(puts.callOp([
            new types.StrLiteral('Hello, world!')
        ]).compile(context), 'puts("Hello, world!")');
    });

    it('should print "hello world" main function', () => {
        assert.equal(
            main.compile(context).replace(/\s+/g, ' '),
            'int main() { puts("Hello, world!"); return 0; }'
        );
    });

    it('should print if-elseif-else construction', () => {
        assert.equal(
            new castle.IfElse([
                { cond: new castle.Var('a'), body: new castle.Block([]) },
                { cond: new castle.Var('b'), body: new castle.Block([]) },
            ], new castle.Block([])).compile(context).replace(/\s+/g, ' '),
            'if (a) { } else if (b) { } else { }'
        );
    });

    it('should print empty infinite loop', () => {
        const whileCode = new castle.While(new types.IntLiteral(1), new castle.Block([]))
            .compile(context)
            .replace(/\s+/g, ' ');
        const loopCode = new castle.Loop(new castle.Block([]))
            .compile(context)
            .replace(/\s+/g, ' ');
        assert.equal(
            whileCode,
            'while (1) { }'
        );
        assert.equal(
            loopCode,
            'while (1) { }'
        );
    });
});

describe('Rust target', () => {
    const context = new castle.Context('rust');

    const main = new castle.Define('main', [], types.unit, new castle.Block([
        new castle.Return(new types.UnitLiteral()),
    ]));

    it('should print empty main function', () => {
        assert.equal(
            main.compile(context).replace(/\s+/g, ' '),
            'fn main() -> () { return (); }'
        );
    });

    it('should print empty infinite loop', () => {
        const whileCode = new castle.While(new types.BoolLiteral(true), new castle.Block([]))
            .compile(context)
            .replace(/\s+/g, ' ');
        const loopCode = new castle.Loop(new castle.Block([]))
            .compile(context)
            .replace(/\s+/g, ' ');
        assert.equal(
            whileCode,
            'while true { }'
        );
        assert.equal(
            loopCode,
            'loop { }'
        );
    })
});
