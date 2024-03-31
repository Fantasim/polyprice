import { Model, IModelOptions, Collection } from 'acey'
import { Pair } from './pair'
import { failRequestHistory } from './fail-history'
import { CEX_PRICE_ENDPOINTS, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, RETRY_LOOKING_FOR_PAIR_INTERVAL, UNFOUND_PAIR_ERROR_CODE } from '../constant'
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

    setDisabledUntil = (time: number) => {
        if (time > Date.now() + 365 * 24 * 60 * 60 * 1000) {
            setInterval(() => {
                console.warn('\x1b[33m%s\x1b[0m', `endpoint ${this.get().name()} has probably changed, fix the issue or ignore it for now in the PolyPrice options`);
            }, 60 * 1000)
        }
        this._disabledUntil = time
    }

    get = () => {
        return {
            requestCount: (): number => this._requestCount,
            name: (): TCEX => this.state.name,
            endpoint: (pair: Pair): string => CEX_PRICE_ENDPOINTS[this.get().name()](pair.get().symbol0(), pair.get().symbol1())
        }
    }

    fetchLastPrice = async (pair: Pair, log?: (o: any) => void) => {
        this._requestCount++
        const r = await fetchPrice(this, pair, log)
        if (typeof r === 'number' && r === ENDPOINT_DOES_NOT_EXIST_ERROR_CODE) {
            this.setDisabledUntil(Date.now() * 2) //forever
        }
        return r
    }
}

export class CEXList extends Collection {

    constructor(state: ICEX_State[] | CEX[] = [], options: IModelOptions) {
        super(state, [CEX, CEXList], options)
    }

    excludeCEXes = (cexes: TCEX[]) => {
        return this.filter((cex: CEX) => !cexes.includes(cex.get().name())) as CEXList
    }

    filterByEnabled = () => this.filter((cex: CEX) => !cex.isDisabled()) as CEXList

    filterAvailableCEXForPair = (pair: Pair): CEXList => {
        const unsupportedCEXes = failRequestHistory.filterByPairAndCodeAfterTime(pair, UNFOUND_PAIR_ERROR_CODE, RETRY_LOOKING_FOR_PAIR_INTERVAL).uniqueCEXes()
        return this.filterByEnabled().excludeCEXes(unsupportedCEXes as TCEX[])
    }

    pickCEXForPair = (pair: Pair): CEX | null => {
        return this.filterAvailableCEXForPair(pair).orderByRequestCountAsc().first() as CEX | null
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