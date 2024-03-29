import {config, manager }from 'acey'
import { CEXList, TCEX, newCexList } from './models/cex'
import { Pair, PairList } from './models/pair'
import { PriceHistoryList } from './models/price-history'
import { CEX_LIST } from './constant'
import { failRequestHistory } from './models/fail-history'

export interface PolyPriceOptions {
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

export class PolyPrice {

    private _running = false
    private _options: PolyPriceOptions
    private _cexList: CEXList
    private _pairList: PairList = new PairList([], {key: 'pairs', connected: true})
    private _priceHistoryMap: {[key: string]: PriceHistoryList} = {}
    private _intervalPairPriceFetch: any
    private _intervalPairPriceHistoryRemove: any

    private _log = (msg: string) => {
        if (this._options.logging)
            console.log(msg)
    }

    constructor(options: PolyPriceOptions){
        options.local_storage && config.setStoreEngine(options.local_storage)
        this._options = Object.assign({}, DEFAULT_OPTIONS, options)
        this._options.ms_request_pair_price_interval = Math.min(this._options.ms_request_pair_price_interval || 0, 60 * 1000) // 1 minute

        const filteredList = CEX_LIST.filter((cex) => !this._options.ignore_cexes || !this._options.ignore_cexes.includes(cex))
        this._cexList = newCexList(filteredList)
        this._log('Active cexes: ' + filteredList.join(', '))

        this._pairList.watch().localStoreFetch(() => {
            this._pairList.forEach((pair) => {
                const history = new PriceHistoryList([], {key: pair.get().id(), connected: true})
                manager.connectModel(history)
                this._priceHistoryMap[pair.get().id()] = history
            })
            this._log('Price history loaded from local storage')
        })
    }

    private _purgePriceHistories = () => {
        const rmInterval = this._options.ms_remove_pair_price_history_interval || 0
        if (rmInterval > 0){
            for (const key in this._priceHistoryMap){
                this._priceHistoryMap[key].removePriceBeforeTime(Date.now() - rmInterval)
            }
        }
        this._log('old price history purged')
    }

    eraseFailHistory = () => {
        failRequestHistory.setState([]).store()
        this._log('Fail history erased')
    }

    addPair = (symbol0: string, symbol1: string) => {
        const err = this._pairList.add(symbol0, symbol1)
        if (typeof err === 'string')
            return err
        err.store()
        return this._pairList.last() as Pair
    }

    private _runIntervals = () => {
        
        const fetchInterval = this._options.ms_request_pair_price_interval as number

        this._intervalPairPriceFetch = setInterval(() => {
            const list = this._pairList.filterByPriceFetchRequired(this._priceHistoryMap, fetchInterval)
            list.slice(0, 10).forEach((p: Pair) => {
                const history = this._priceHistoryMap[p.get().id()]
                const purged = this._pairList.purgePairIfUnfound(p, this._priceHistoryMap[p.get().id()], this._cexList.count())
                if (!purged)
                    p.fetchLastPriceIfNeeded(this._cexList, history, fetchInterval, this._log)
                else 
                    this._log(`Pair ${p.get().id()} removed`)
            })
        }, 20 * 1000)

        this._log('Pair price fetch interval: ' + fetchInterval / 1000 + ' seconds')

        const rmInterval = this._options.ms_remove_pair_price_history_interval || 0

        if (rmInterval > 0){
            this._intervalPairPriceHistoryRemove = setInterval(this._purgePriceHistories, 60 * 60 * 1000) // 1 hour
        }

        this._log('Price history remove interval: ' + rmInterval / 1000 + ' seconds')
    }

    private _clearIntervals = () => {
        clearInterval(this._intervalPairPriceFetch)
        clearInterval(this._intervalPairPriceHistoryRemove)
        this._log('Intervals cleared')
    }

    run = () => {
        if (this._running)
            return
        config.done()
        this._running = true
        this._purgePriceHistories()
        this._runIntervals()
        this._log('PolyPrice started')
    }

    stop = () => {
        if(!this._running)
            return
        this._running = false
        this._clearIntervals()
        this._log('PolyPrice stopped')
    }

    isRunning = () => {
        return this._running
    }
}