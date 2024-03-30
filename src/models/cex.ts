import { Model, IModelOptions, Collection } from 'acey'
import { Pair } from './pair'
import { failRequestHistory } from './fail-history'
import { RETRY_LOOKING_FOR_PAIR_INTERVAL, UNFOUND_PAIR_ERROR_CODE } from '../constant'
import { fetchPrice } from '../fetching-engine'

export type TCEX  = 'binance' | 'coinbase' | 'kraken' | /* 'bitfinex' | 'bitstamp' | */ 'gemini' | 'kucoin'

interface ICEX_State {
    name: TCEX
}

const DEFAULT_STATE: ICEX_State = {
    name: 'binance'
}

export class CEX extends Model {

    private _requestCount = 0
    private _disabledUntil = 0

    constructor(state: ICEX_State = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    isDisabled = () => Date.now() < this._disabledUntil
    setDisabledUntil = (time: number) => this._disabledUntil = time

    get = () => {
        return {
            requestCount: (): number => this._requestCount,
            name: (): TCEX => this.state.name,
            endpoint: (pair: Pair): string => {
                switch (this.get().name()) {
                    case 'binance':
                        return `https://api.binance.com/api/v3/ticker/price?symbol=${pair.get().symbol0()}${pair.get().symbol1()}`
                    case 'coinbase':
                        return `https://api.pro.coinbase.com/products/${pair.get().symbol0()}-${pair.get().symbol1()}/ticker`
                    case 'kraken':
                        return `https://api.kraken.com/0/public/Ticker?pair=${pair.get().symbol0()}${pair.get().symbol1()}`
                    // case 'bitfinex': //XXX
                    //     return `https://api-pub.bitfinex.com/v2/ticker/t${pair.get().symbol0()}${pair.get().symbol1()}`
                    // case 'bitstamp': //XXX
                    //     return `https://www.bitstamp.net/api/v2/ticker/${pair.get().symbol0().toLowerCase()}${pair.get().symbol1().toLowerCase()}`
                    case 'gemini':
                        return `https://api.gemini.com/v1/pubticker/${pair.get().symbol0().toLowerCase()}${pair.get().symbol1().toLowerCase()}`
                    case 'kucoin':
                        return `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${pair.get().symbol0()}-${pair.get().symbol1()}`
                    default:
                        return ''
                }
            }
        }
    }

    fetchLastPrice = (pair: Pair, log?: (o: any) => void) => fetchPrice(this, pair, log)
}

export class CEXList extends Collection {

    constructor(state: ICEX_State[] | CEX[] = [], options: IModelOptions) {
        super(state, [CEX, CEXList], options)
    }

    excludeCEXes = (cexes: TCEX[]) => {
        return this.filter((cex: CEX) => !cexes.includes(cex.get().name())) as CEXList
    }

    filterByEnabled = () => this.filter((cex: CEX) => !cex.isDisabled()) as CEXList

    pickCEXForPair = (pair: Pair): CEX | null => {
        const unsupportedCEXes = failRequestHistory.filterByPairAndCodeAfterTime(pair, UNFOUND_PAIR_ERROR_CODE, RETRY_LOOKING_FOR_PAIR_INTERVAL).uniqueCEXes()
        const cex = this.filterByEnabled().excludeCEXes(unsupportedCEXes as TCEX[]).orderByRequestCountAsc().first()
        return cex as CEX || null
    }

    orderByRequestCountAsc = () => this.orderBy((c: CEX) => c.get().requestCount(), 'asc') as CEXList
    findByName = (name: TCEX): CEX | null => this.find((cex: CEX) => cex.get().name() === name) as CEX || null
}

export const newCexList = (list: TCEX[]) => {
    const cexList = new CEXList([], {key: 'cexes', connected: false})
    list.forEach((name) => {
        cexList.push({name, last_activity: 0})
    })
    return cexList
}