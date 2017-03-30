const {assert} = require('chai');
const castle = require('../lib');
const types = require('../lib/types');

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
        assert.equal(
            new castle.While(new types.IntLiteral(1), new castle.Block([]))
                .compile(context)
                .replace(/\s+/g, ' '),
            'while (1) { }'
        );
    });
});
