import { Model, IModelOptions, Collection } from 'acey'
import { Pair } from './pair'
import { PriceHistoryList } from './price-history'
import { safeParsePrice } from '../utils'
import { failedRequestHistory } from './failed-history'
import { ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, UNABLE_TO_PARSE_PRICE_ERROR_CODE, UNABLE_TO_REACH_SERVER_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from '../constant'

export type TCEX  = 'binance' | 'coinbase' | 'kraken' | /* 'bitfinex' | 'bitstamp' | */ 'gemini' | 'kucoin'

interface ICEX_State {
    name: TCEX
    last_activity: number
}

const DEFAULT_STATE: ICEX_State = {
    name: 'binance',
    last_activity: 0
}

class CEX extends Model {

    constructor(state: ICEX_State = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            name: (): TCEX => this.state.name,
            lastActivity: (): Date => new Date(this.state.last_activity * 1000),
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

    fetchPrice = async (pair: Pair, priceHistoryList: PriceHistoryList) => {
        const endpointURL = this.get().endpoint(pair)
        const controller = new AbortController();
        const signal = controller.signal;
        
        const timeoutMs = 5000; // Timeout duration in milliseconds
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response: Response = typeof window !== 'undefined' ? await fetch(endpointURL, {signal}) : await require('node-fetch')(endpointURL, {signal}) as Response
            if (response.status === 200){
                const json = await response.json()
                let unparsedPrice
                let code: number = 200

                try {
                    switch (this.get().name()) {
                        case 'binance':
                            unparsedPrice = json.price
                        case 'coinbase':
                            unparsedPrice = json.price
                        case 'kraken':
                            const keys = Object.keys(json.result)
                            if (keys[0] === 'error'){
                                code = UNFOUND_PAIR_ERROR_CODE
                                break
                            }
                            unparsedPrice = json.result[keys[0]].c[0]
                        // case 'bitfinex':
                        //     unparsedPrice = json[6]
                        // case 'bitstamp':
                        //     unparsedPrice = json.last
                        case 'gemini':
                            unparsedPrice = json.last
                        case 'kucoin':
                            if (!!json.data)
                            unparsedPrice = json.data.price
                            else
                                code = UNFOUND_PAIR_ERROR_CODE
                    }
                } catch (error) {
                    code = UNABLE_TO_PARSE_PRICE_ERROR_CODE
                }

                const priceOrError = safeParsePrice(unparsedPrice)
                if (typeof priceOrError === 'number' && code === 200)
                    return priceHistoryList.add(pair, this.get().name(), priceOrError as number)
                else if (code !== 200)
                    return failedRequestHistory.add(pair, this.get().name(), code)
                else
                return failedRequestHistory.add(pair, this.get().name(), UNABLE_TO_PARSE_PRICE_ERROR_CODE)
            } else {
                if (response.status === 400){
                    return failedRequestHistory.add(pair, this.get().name(), UNFOUND_PAIR_ERROR_CODE)
                } else if (response.status === 404){
                    if (this.get().name() === 'coinbase'){
                        const json = await response.json()
                        const keys = Object.keys(json)
                        if (keys[0] === 'message' && json[keys[0]] === 'NotFound'){
                            return failedRequestHistory.add(pair, this.get().name(), UNFOUND_PAIR_ERROR_CODE)
                        } else if (keys[0] === 'message' && json[keys[0]] === 'Unauthorized.'){
                            return failedRequestHistory.add(pair, this.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE)
                        }
                    }
                    return failedRequestHistory.add(pair, this.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE)
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return failedRequestHistory.add(pair, this.get().name(), UNABLE_TO_REACH_SERVER_ERROR_CODE)
            } else {
                console.error('Fetch error:', error.message);
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

    findByName = (name: TCEX) => {
        return this.find((cex: CEX) => cex.get().name() === name)
    }
}

export const newCexList = (list: TCEX[]) => {
    const cexList = new CEXList([], {key: 'cexes', connected: false})
    list.forEach((name) => {
        cexList.push({name, last_activity: 0})
    })
    return cexList
}