import  { Collection, IModelOptions, Model } from 'acey';
import { IPriceHistory, PriceHistory, PriceHistoryList } from './price-history';
import { failRequestHistory } from './fail-history';
import { CEXList, TCEX } from './cex';
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

    //Returns true if the pair has been tried to be fetched from all the CEXes and failed
    isTrash = () => {
        const { cexList } = controller
        const activeCEXCount = cexList.count()
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000 // 6 hours

        const priceHistory = this.get().priceHistoryList()
        //if there is no price history instance, it means the pair has been removed so it is trash
        if (!priceHistory)
            return true

        const price = priceHistory.filterAfterTime(Date.now() - sixHoursAgo)
        if (price.count() === 0){
            const list = failRequestHistory.filterByPairAndCodeAfterTime(this, UNFOUND_PAIR_ERROR_CODE, Date.now() - RETRY_LOOKING_FOR_PAIR_INTERVAL).uniqueCEXes()
            return list.length >= activeCEXCount
        }
        return false
    }

    lastPrice = (): IPriceHistory | null => {
        const historyList = this.get().priceHistoryList()
        if (!historyList)
            return null

        const p = historyList.findLastPrice()
        return p ? p.to().plain() as IPriceHistory : null
    }

    //Returns true if the last price is older than the interval
    needToBeFetched = (interval: number) => {
        const historyList = this.get().priceHistoryList()
        //if there is no price history instance, it means the pair has been removed
        if (!historyList)
            return false

        const lastPrice = historyList.findLastPrice()
        return !lastPrice || lastPrice.wasItMoreThanTimeAgo(interval)
    }   

    //Fetches the last price from the CEX that has the pair
    fetchLastPriceIfNeeded = (interval: number) => {
        const { cexList } = controller
        if (this.needToBeFetched(interval)){
            const cex = cexList.pickCEXForPair(this)
            return cex ? cex.fetchLastPrice(this) : null
        }
        return null
    }

    get = () => {
        return {
            id: (): string => buildKey(this.state.symbol0, this.state.symbol1),
            symbol0: (): string => this.state.symbol0,
            symbol1: (): string => this.state.symbol1,
            createdAt: (): Date => new Date(this.state.created_at * 1000),
            priceHistoryList: (): PriceHistoryList => controller.priceHistoryMap[this.get().id()] 
        }
    }
}

export class PairList extends Collection {

    constructor(state: IPairState[] | Pair[] = [], options: IModelOptions) {
        super(state, [Pair, PairList], options)
    }

    filterBySymbol = (symbol: string) => {
        return this.filter((pair: Pair) => pair.get().symbol0() === symbol.toLowerCase() || pair.get().symbol1() === symbol.toLowerCase()) as PairList
    }

    filterByPriceFetchRequired = (interval: number) => {
        return this.filter((pair: Pair) => pair.needToBeFetched(interval)) as PairList
    }

    findByPair = (symbol0: string, symbol1: string) => {
        return this.find((pair: Pair) => {
            return pair.get().id() === buildKey(symbol0, symbol1)
        }) as Pair
    }

    add = (symbol0: string, symbol1: string) => {
        const exist = this.findByPair(symbol0, symbol1)
        if (exist){
            return exist
        }

        const lastFail = failRequestHistory.findLastByPairID(buildKey(symbol0, symbol1))
        if (lastFail && !lastFail.wasItMoreThanATimeAgo(RETRY_LOOKING_FOR_PAIR_INTERVAL))
            return 'pair already been tried and failed recently'

        const p: IPairState = {
            symbol0: symbol0.toUpperCase(),
            symbol1: symbol1.toUpperCase(),
            created_at: Math.floor(Date.now() / 1000)
        }

        return this.push(p)
    }
}