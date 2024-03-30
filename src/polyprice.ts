import {config, manager }from 'acey'
import { CEX, CEXList, TCEX, newCexList } from './models/cex'
import { Pair, PairList } from './models/pair'
import { PriceHistoryList } from './models/price-history'
import { CEX_LIST } from './constant'
import { failRequestHistory } from './models/fail-history'

class Controller {

    private _log = (...msg: any) => {
        if (this._logging)
            console.log(...msg)
    }

    private _logging = false
    public cexList: CEXList
    public pairList: PairList = new PairList([], {key: 'pairs', connected: true})
    public priceHistoryMap: {[key: string]: PriceHistoryList} = {}

    constructor(){
        this.cexList = newCexList(CEX_LIST)

        this.pairList.watch().localStoreFetch(() => {
            this.pairList.forEach((pair) => {
                const history = new PriceHistoryList([], {key: pair.get().id(), connected: true})
                manager.connectModel(history)
                this.priceHistoryMap[pair.get().id()] = history
            })
            // this._log('Price history loaded from local storage')
        })
    }

    setCEXList = (ignore_cexes: TCEX[]) => {
        const filteredList = CEX_LIST.filter((cex) => !ignore_cexes.includes(cex))
        this.cexList.deleteBy((cex: CEX) => !filteredList.includes(cex.get().name()))
    }

     purgePriceHistories = (rmPairPriceHistoryInterval: number) => {
        if (rmPairPriceHistoryInterval > 0){
            for (const key in this.priceHistoryMap){
                this.priceHistoryMap[key].removePriceBeforeTime(Date.now() - rmPairPriceHistoryInterval)
            }
        }
        this._log('old price history purged')
    }

    addPair = (symbol0: string, symbol1: string) => {
        const { pairList, priceHistoryMap } = this

        const err = pairList.add(symbol0, symbol1)
        if (typeof err === 'string')
            return err
        err.store()
        const pair = pairList.last() as Pair

        const history = new PriceHistoryList([], {key: pair.get().id(), connected: true})
        manager.connectModel(history)
        priceHistoryMap[pair.get().id()] = history
        return pair
    }

    refreshOrClearPair = (fetchInterval: number) => {

        const list = this.pairList.filterByPriceFetchRequired(fetchInterval)
            list.slice(0, 10).forEach((p: Pair) => {
                const key = p.get().id()
                const purged = this.pairList.purgePairIfUnfound(p, this._log)
                if (!purged)
                    p.fetchLastPriceIfNeeded(fetchInterval, this._log)
                else {
                    //remove the price history from the map
                    delete this.priceHistoryMap[key] 
                    //remove the price history from the local storage
                    manager.localStoreManager().removeKey(key)
                    this._log(`Price history of ${p.get().id()} removed`)

                    const symbols = key.split('-')

                    //if a pair failed, we try to add it again reversed
                    this.addPair(symbols[1], symbols[0])
                }
            })
    }

    setLogging = (logging: boolean) => {
        this._logging = logging
    }

}

export const controller = new Controller()

export interface PolyPriceOptions {
    local_storage?: any
    //default: 10 minutes
    interval_pair_price_request_ms?: number
    //cexes to ignore
    ignore_cexes?: TCEX[]
    //default: 0 (never)
    max_age_price_history_before_purge_ms?: number
    logging?: boolean
}

const DEFAULT_OPTIONS: PolyPriceOptions = {
    interval_pair_price_request_ms: 10 * 60 * 1000, // 10 minutes
    max_age_price_history_before_purge_ms: 0,
    ignore_cexes: [],
    logging: false
}

export class PolyPrice {

    private _running = false
    private _options: PolyPriceOptions
    private _intervalPairPriceFetch: any
    private _intervalPairPriceHistoryRemove: any

    private _log = (...msg: any) => {
        if (this.options().logginEnabled())
            console.log(...msg)
    }

    options = () => {
        return {
            priceFetchInterval: () => Math.min(this._options.interval_pair_price_request_ms || 0, 60 * 1000), // 1 minute minimum
            removePriceHistoryInterval: () => Math.min(this._options.max_age_price_history_before_purge_ms || 0, 0), // 0 means never
            logginEnabled: () => !!this._options.logging,
            disactivedCEXes: () => this._options.ignore_cexes || [],
        }
    }

    constructor(options: PolyPriceOptions){
        options.local_storage && config.setStoreEngine(options.local_storage)
        this._options = Object.assign({}, DEFAULT_OPTIONS, options)
        
        controller.setCEXList(this.options().disactivedCEXes())
        controller.setLogging(this.options().logginEnabled())
    }

    eraseFailHistory = () => {
        failRequestHistory.setState([]).store()
        this._log('Fail history erased')
    }

    addPair = controller.addPair

    private _runIntervals = () => {
        
        this._intervalPairPriceFetch = setInterval(() => {
            controller.refreshOrClearPair(this.options().priceFetchInterval())
        }, 20 * 1000)

        this._log('Pair price fetch interval: ' + this.options().priceFetchInterval() / 1000 + ' seconds')

        const removeInterval = this.options().removePriceHistoryInterval()
        if (removeInterval)
            this._intervalPairPriceHistoryRemove = setInterval(() => controller.purgePriceHistories(removeInterval), 60 * 60 * 1000) // 1 hour
        
        this._log('Price history remove interval:', removeInterval > 0 ? removeInterval / 1000 + ' seconds' : 'never')
    }

    private _clearIntervals = () => {
        clearInterval(this._intervalPairPriceFetch)
        clearInterval(this._intervalPairPriceHistoryRemove)
        this._log('Intervals cleared')
    }

    run = async () => {
        if (this._running)
            return
        await config.done()
        this._running = true
        controller.purgePriceHistories(this.options().removePriceHistoryInterval())
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