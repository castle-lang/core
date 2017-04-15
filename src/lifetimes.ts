import {Context, Node} from './index';

export abstract class Lifetime implements Node {
  public abstract compile(context: Context): string;
}
