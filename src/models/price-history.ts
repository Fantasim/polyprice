import { IModelOptions, Model, Collection } from 'acey'
import { CEX, TCEX } from './cex'
import { Pair } from './pair'
import { controller } from '../polyprice'

interface IPriceHistory {
    price: number
    time: number
    cex: TCEX
}

const DEFAULT_STATE: IPriceHistory = {
    price: 0,
    time: 0,
    cex: 'binance'
}

export class PriceHistory extends Model {
    
    constructor(state: IPriceHistory = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            price: (): number => this.state.price,
            time: (): Date => new Date(this.state.time * 1000),
            cex: (): TCEX => this.state.cex,
            CEX: (): CEX => controller.cexList.findByName(this.state.cex) as CEX
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

    filterByCEX = (cex: TCEX) => {      
        return this.filter((priceHistory: PriceHistory) => {
            return priceHistory.get().cex() === cex
        }) as PriceHistoryList
    }

    filterAfterTime = (after: number) => {
        return this.filter((priceHistory: PriceHistory) => {
            return priceHistory.get().time().getTime() > after
        }) as PriceHistoryList
    }

    findLastPriceByCEX = (cex: TCEX): PriceHistory | null => {
        return this.find((priceHistory: PriceHistory) => {
            return priceHistory.get().cex() === cex
        }) as PriceHistory | null
    }
    
    findLastPrice = (): PriceHistory | null => {
        return this.first() as PriceHistory || null
    }

    add = (price: number, cex: TCEX) => {
        const ph: IPriceHistory ={
            price,
            time: Math.floor(Date.now() / 1000),
            cex
        }
        
        return this.prepend([ph])
    }
}