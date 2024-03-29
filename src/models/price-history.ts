import { IModelOptions, Model, Collection } from 'acey'
import { TCEX } from './cex'
import { Pair } from './pair'

interface IPriceHistory {
    pair_id: string
    price: number
    time: number
}

const DEFAULT_STATE: IPriceHistory = {
    pair_id: '',
    price: 0,
    time: 0
}

export class PriceHistory extends Model {
    
    constructor(state: IPriceHistory = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            pairID: (): string => this.state.pair_id,
            price: (): number => this.state.price,
            time: (): Date => new Date(this.state.time * 1000)
        }
    }
}

export class PriceHistoryList extends Collection {
    
    constructor(state: IPriceHistory[] | PriceHistory[] = [], options: IModelOptions) {
        super(state, [PriceHistory, PriceHistoryList], options)
    }

    add = (pair: Pair, cex: TCEX, price: number) => {
        const ph: IPriceHistory ={
            pair_id: `${pair.get().id()}-${cex}`,
            price: price,
            time: Date.now() / 1000
        }
        
        return this.push(ph)
    }
}