import {Node, Context} from './index';

export abstract class Lifetime implements Node {
    abstract compile(context: Context): string;
}
