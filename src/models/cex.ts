import { Model, IModelOptions, Collection } from 'acey'
import { Pair } from './pair'
import { PriceHistoryList } from './price-history'
import { safeParsePrice } from '../utils'
import { failRequestHistory } from './fail-history'
import { ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, RETRY_LOOKING_FOR_PAIR_INTERVAL, UNABLE_TO_PARSE_PRICE_ERROR_CODE, UNABLE_TO_REACH_SERVER_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from '../constant'
import fetch from "node-fetch-native";

export type TCEX  = 'binance' | 'coinbase' | 'kraken' | /* 'bitfinex' | 'bitstamp' | */ 'gemini' | 'kucoin'

interface ICEX_State {
    name: TCEX
}

const DEFAULT_STATE: ICEX_State = {
    name: 'binance'
}

class CEX extends Model {

    private _requestCount = 0
    private _disabledUntil = 0

    constructor(state: ICEX_State = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    isDisabled = () => Date.now() < this._disabledUntil

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

    fetchPrice = async (pair: Pair, priceHistoryList: PriceHistoryList, log?: (o: any) => void) => {
        const endpointURL = this.get().endpoint(pair)
        const controller = new AbortController();
        const signal = controller.signal;
        
        const timeoutMs = 5000; // Timeout duration in milliseconds
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            this._requestCount++
            log && log(`Fetching price from ${this.get().name()} for ${pair.get().id()}`)

            const response = await fetch(endpointURL, {signal})
            log && log(`Response status from ${this.get().name()} for ${pair.get().id()}: ${response.status}`)
            if (response.status === 200){
                const json = await response.json() as any
                let unparsedPrice
                let code: number = 200

                try {
                    switch (this.get().name()) {
                        case 'binance':
                            unparsedPrice = json.price
                            break;
                        case 'coinbase':
                            unparsedPrice = json.price
                            break
                        case 'kraken':
                            const keys = Object.keys(json.result)
                            if (keys[0] === 'error'){
                                code = UNFOUND_PAIR_ERROR_CODE
                                break
                            }
                            unparsedPrice = json.result[keys[0]].c[0]
                        // case 'bitfinex':
                        //     unparsedPrice = json[6]
                        //     break
                        // case 'bitstamp':
                        //     unparsedPrice = json.last
                        //     break
                        case 'gemini':
                            unparsedPrice = json.last
                            break;
                        case 'kucoin':
                            if (!!json.data)
                            unparsedPrice = json.data.price
                            else
                                code = UNFOUND_PAIR_ERROR_CODE
                            break;
                    }
                } catch (error) {
                    console.log(error)
                    code = UNABLE_TO_PARSE_PRICE_ERROR_CODE
                }

                const priceOrError = safeParsePrice(unparsedPrice)
                if (typeof priceOrError === 'number' && code === 200){
                    log && log(`New price from ${this.get().name()} for ${pair.get().id()}: ${priceOrError}`)
                    return priceHistoryList.add(priceOrError as number).store()                    
                }
                else if (code !== 200)
                    return failRequestHistory.add(pair, this.get().name(), code, log)
                else
                return failRequestHistory.add(pair, this.get().name(), UNABLE_TO_PARSE_PRICE_ERROR_CODE, log)
            } else {
                if (response.status === 429){
                    this._disabledUntil = Date.now() + 60 * 1000 // 1 minute
                } else if (response.status === 400){
                    return failRequestHistory.add(pair, this.get().name(), UNFOUND_PAIR_ERROR_CODE, log)
                } else if (response.status === 404){
                    if (this.get().name() === 'coinbase'){
                        const json = await response.json() as any
                        const keys = Object.keys(json)
                        if (keys[0] === 'message' && json[keys[0]] === 'NotFound'){
                            return failRequestHistory.add(pair, this.get().name(), UNFOUND_PAIR_ERROR_CODE, log)
                        } else if (keys[0] === 'message' && json[keys[0]] === 'Unauthorized.'){
                            return failRequestHistory.add(pair, this.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, log)
                        }
                    }
                    return failRequestHistory.add(pair, this.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, log)
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return failRequestHistory.add(pair, this.get().name(), UNABLE_TO_REACH_SERVER_ERROR_CODE, log)
            } else {
                log && log(`Fetch error from ${this.get().name()} for ${pair.get().id()}}: ${error.message}`)
            }
        } finally{
            clearTimeout(timeoutId);
        }
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

    pickCEXForPair = (pair: Pair): CEX | null => {
        const unsupportedCEXes = failRequestHistory.filterByPairAndCodeAfterTime(pair, UNFOUND_PAIR_ERROR_CODE, RETRY_LOOKING_FOR_PAIR_INTERVAL).uniqueCEXes()
        const cex = this.filterByEnabled().excludeCEXes(unsupportedCEXes as TCEX[]).orderByRequestCountAsc().first()
        return cex as CEX || null
    }

    orderByRequestCountAsc = () => this.orderBy((c: CEX) => c.get().requestCount(), 'asc') as CEXList
    findByName = (name: TCEX) => this.find((cex: CEX) => cex.get().name() === name) || null
}

export const newCexList = (list: TCEX[]) => {
    const cexList = new CEXList([], {key: 'cexes', connected: false})
    list.forEach((name) => {
        cexList.push({name, last_activity: 0})
    })
    return cexList
}