import {config, manager }from 'acey'
import { CEXList, TCEX, newCexList } from './models/cex'
import { PairList } from './models/pair'
import { PriceHistoryList } from './models/price-history'
//parameters: 
//1. acey node store
//2 request les prix tous les combiens de temps
//3 supprimer les prix tous les combiens de temps (0 pour jamais)
//4 les pairs à surveiller

interface PolyPriceOptions {
    local_storage?: any
    ms_request_pair_price_interval?: number
    ignore_cexes?: TCEX[]
    ms_remove_pair_price_history_interval?: number
    logging?: boolean
}

const DEFAULT_OPTIONS: PolyPriceOptions = {
    ms_request_pair_price_interval: 10 * 60 * 1000, // 10 minutes
    ms_remove_pair_price_history_interval: 0, // never
    ignore_cexes: [],
    logging: false
}

const CEX_LIST: TCEX [] = ['binance', 'coinbase', 'kraken']

export class PolyPrice {

    private _running = false
    private _options: PolyPriceOptions
    private _cexList: CEXList
    private _pairList: PairList = new PairList([], {key: 'pairs', connected: true})
    private _priceHistoryList: PriceHistoryList[] = []

    constructor(options: PolyPriceOptions){
        options.local_storage && config.setStoreEngine(options.local_storage)
        this._options = Object.assign({}, DEFAULT_OPTIONS, options)
        
        const filteredList = CEX_LIST.filter((cex) => !this._options.ignore_cexes || !this._options.ignore_cexes.includes(cex))
        this._cexList = newCexList(filteredList)
        this._pairList.watch().localStoreFetch(() => {
            this._priceHistoryList = this._pairList.map((pair) => {
                return new PriceHistoryList([], {key: pair.get().symbol0().toLowerCase() + '-' + pair.get().symbol1().toLowerCase(), connected: true})
            })
            this._priceHistoryList.forEach((priceHistoryList) => {
                manager.connectModel(priceHistoryList)
            })
        })


    }

    addPair = (symbol0: string, symbol1: string) => {

    }

    run = () => {
        if(this._running)
            return
        config.done()
    }

    stop = () => {
        if(!this._running)
            return
    }

    isRunning = () => {
        return this._running
    }
}