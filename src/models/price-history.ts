import { IModelOptions, Model, Collection } from 'acey'
import { TCEX } from './cex'
import { Pair } from './pair'

interface IPriceHistory {
    price: number
    time: number
}

const DEFAULT_STATE: IPriceHistory = {
    price: 0,
    time: 0
}

export class PriceHistory extends Model {
    
    constructor(state: IPriceHistory = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            price: (): number => this.state.price,
            time: (): Date => new Date(this.state.time * 1000)
        }
    }

    wasItMoreThanTimeAgo = (time: number) => {
        return (Date.now() - this.get().time().getTime()) > time
    }
}

export class PriceHistoryList extends Collection {
    
    constructor(state: IPriceHistory[] | PriceHistory[] = [], options: IModelOptions) {
        super(state, [PriceHistory, PriceHistoryList], options)
    }

    removePriceBeforeTime = (limit: number) => {
        let count = 0
        this.deleteBy((priceHistory: PriceHistory) => {
            if (priceHistory.get().time().getTime() < limit){
                count++
                return true
            }
            return false
        })
        count > 0 && this.action().store()
    }


    filterAfterTime = (after: number) => {
        return this.filter((priceHistory: PriceHistory) => {
            return priceHistory.get().time().getTime() > after
        }) as PriceHistoryList
    }

    findLastPrice = (): PriceHistory | null => {
        return this.first() as PriceHistory || null
    }

    add = (price: number) => {
        const ph: IPriceHistory ={
            price,
            time: Math.floor(Date.now() / 1000)
        }
        
        return this.prepend([ph])
    }
}