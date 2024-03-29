import  { Collection, IModelOptions, Model } from 'acey';
import { PriceHistoryList } from './price-history';
import { failRequestHistory } from './fail-history';
import { CEXList } from './cex';
import { RETRY_LOOKING_FOR_PAIR_INTERVAL, UNFOUND_PAIR_ERROR_CODE } from '../constant';

interface IPairState {
    symbol0: string
    symbol1: string
    created_at: number
}

export class Pair extends Model {

    constructor(state: IPairState, options:IModelOptions) {
        super(state, options)
    }

    needToBeFetched = (history: PriceHistoryList, interval: number) => {
        const lastPrice = history.findLastPrice()
        return !lastPrice || lastPrice.wasItMoreThanTimeAgo(interval)
    }   

    fetchLastPriceIfNeeded = (cexes: CEXList, history: PriceHistoryList, interval: number) =>{
        if (this.needToBeFetched(history, interval)){
            const cex = cexes.pickCEXForPair(this)
            return cex ? cex.fetchPrice(this, history) : null
        }
        return null
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

    filterByPriceFetchRequired = (priceHistoryMap: {[key: string]: PriceHistoryList}, interval: number) => {
        return this.filter((pair: Pair) => {
            const history = priceHistoryMap[pair.get().id()]
            return pair.needToBeFetched(history, interval)
        }) as PairList
    }

    deleteByID = (id: string) => {
        return this.deleteBy((pair: Pair) => {
            return pair.get().id() === id
        })
    }

    purgePairIfUnfound = (pair: Pair, priceHistory: PriceHistoryList, activeCEXCount: number) => {
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000 // 6 hours
        const price = priceHistory.filterAfterTime(Date.now() - sixHoursAgo)
        if (price.count() === 0){
            const list = failRequestHistory.filterByPairAndCodeAfterTime(pair, UNFOUND_PAIR_ERROR_CODE, Date.now() - RETRY_LOOKING_FOR_PAIR_INTERVAL).uniqueCEXes()
            if (list.length >= activeCEXCount){
                this.deleteByID(pair.get().id()).store()
                return true
            }
        }
        return false
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