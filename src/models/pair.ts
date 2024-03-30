import  { Collection, IModelOptions, Model } from 'acey';
import { PriceHistoryList } from './price-history';
import { failRequestHistory } from './fail-history';
import { CEXList } from './cex';
import { RETRY_LOOKING_FOR_PAIR_INTERVAL, UNFOUND_PAIR_ERROR_CODE } from '../constant';
import { buildKey } from '../utils';
import { controller } from '../polyprice';

interface IPairState {
    symbol0: string
    symbol1: string
    created_at: number
}

export class Pair extends Model {

    constructor(state: IPairState, options:IModelOptions) {
        super(state, options)
    }
    

    needToBeFetched = (interval: number) => {
        const history = controller.priceHistoryMap[this.get().id()]

        const lastPrice = history.findLastPrice()
        return !lastPrice || lastPrice.wasItMoreThanTimeAgo(interval)
    }   

    fetchLastPriceIfNeeded = (interval: number, log?: ((o: any) => void)) => {
        const { cexList } = controller
        if (this.needToBeFetched(interval)){
            const cex = cexList.pickCEXForPair(this)
            return cex ? cex.fetchPrice(this, log) : null
        }
        return null
    }

    get = () => {
        return {
            id: (): string => buildKey(this.state.symbol0, this.state.symbol1),
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

    filterByPriceFetchRequired = (interval: number) => {
        return this.filter((pair: Pair) => pair.needToBeFetched(interval)) as PairList
    }

    deleteByID = (id: string) => {
        return this.deleteBy((pair: Pair) => {
            return pair.get().id() === id
        })
    }

    purgePairIfUnfound = (pair: Pair) => {
        const { priceHistoryMap, cexList } = controller
        const activeCEXCount = cexList.count()
        const priceHistory = priceHistoryMap[pair.get().id()]
            
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
            return pair.get().id() && buildKey(symbol0, symbol1)
        }) as Pair
    }

    add = (symbol0: string, symbol1: string) => {
        if (this.findByPair(symbol0, symbol1))
            return 'pair already exists'

        const lastFail = failRequestHistory.findLastByPairID(buildKey(symbol0, symbol1))
        if (lastFail && !lastFail.wasItMoreThanAWeekAgo())
            return 'pair already been tried and failed recently'

        const p: IPairState = {
            symbol0: symbol0.toUpperCase(),
            symbol1: symbol1.toUpperCase(),
            created_at: Math.floor(Date.now() / 1000)
        }

        return this.push(p)
    }
}