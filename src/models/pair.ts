import  { Collection, IModelOptions, Model } from 'acey';

interface IPairState {
    symbol0: string
    symbol1: string
    created_at: number
}

export class Pair extends Model {

    constructor(state: IPairState, options:IModelOptions) {
        super(state, options)
    }


    get = () => {
        return {
            id: (): string => this.get().symbol0().toLowerCase() + '-' + this.get().symbol1().toLowerCase(),
            symbol0: (): string => this.state.symbol0,
            symbol1: (): string => this.state.symbol1,
            createdAt: (): Date => new Date(this.state.created_at * 1000)
        }
    }
}

export class PairList extends Collection {

    constructor(state: IPairState[] | Pair[] = [], options: IModelOptions) {
        super(state, [Pair, PairList], options)
    }

    findByPair = (symbol0: string, symbol1: string) => {
        return this.find((pair: Pair) => {
            return pair.get().symbol0() === symbol0.toUpperCase() && pair.get().symbol1() === symbol1.toUpperCase()
        }) as Pair
    }

    add = (symbol0: string, symbol1: string) => {
        if (this.findByPair(symbol0, symbol1))
            return 'pair already exists'

        const p: IPairState = {
            symbol0: symbol0.toUpperCase(),
            symbol1: symbol1.toUpperCase(),
            created_at: Date.now() / 1000
        }

        return this.push(p)
    }
}