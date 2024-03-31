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

        const res = pairList.add(symbol0, symbol1)
        //if error
        if (typeof res === 'string'){
            return res
        }
        //if the pair already exists
        if (res instanceof Pair){
            return res
        }
        //if the pair has been added
        res.store()

        const pair = pairList.last() as Pair
        const history = new PriceHistoryList([], {key: pair.get().id(), connected: true})
        manager.connectModel(history)
        priceHistoryMap[pair.get().id()] = history
        return pair
    }

    /* 
        Remove a pair from the list
        if tryAgainWithPairReversed is true, the pair will be added again reversed if it didn't already failed before.
        The function returns the new pair if it was added again reversed, null otherwise
    */
    removePair = (symbol0: string, symbol1: string, tryAgainWithPairReversed: boolean = false) => {
        const pair = this.pairList.findByPair(symbol0, symbol1)
        if (pair){
            const key = pair.get().id()
            
            this.pairList.delete(pair).store()
            this._log(`Pair ${key} removed`)

            delete this.priceHistoryMap[key]
            //remove the price history from the local storage
            manager.localStoreManager().removeKey(key)

            this._log(`Price history of ${pair.get().id()} removed`)

            if (tryAgainWithPairReversed){
                const symbols = key.split('-')
                //if a pair failed, we try to add it again reversed
                const newPair = this.addPair(symbols[1], symbols[0])
                if (newPair instanceof Pair){
                    return newPair
                }
            }
        }
        return null
    }

    refreshOrClearPair = async (fetchInterval: number) => {
        const MAXIMUM_FETCH_PER_BATCH = 10
        const list = this.pairList.filterByPriceFetchRequired(fetchInterval)
        for (let i = 0; i < Math.min(list.count(), MAXIMUM_FETCH_PER_BATCH); i++){
            const pair = list.nodeAt(i) as Pair
            await pair.fetchLastPriceIfNeeded(fetchInterval, this._log)
        }
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

    private options = () => {
        return {
            priceFetchInterval: () => Math.max(this._options.interval_pair_price_request_ms || 0, 60 * 1000), // 1 minute minimum
            removePriceHistoryInterval: () => Math.max(this._options.max_age_price_history_before_purge_ms || 0, 0), // 0 means never
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

    clearFailHistory = () => {
        failRequestHistory.setState([]).store()
        this._log('Fail history erased')
    }

    addPair = controller.addPair
    removePair = controller.removePair
    findPair = (symbol0: string, symbol1: string): Pair | null => controller.pairList.findByPair(symbol0, symbol1) || null

    private _runIntervals = () => {
        const REFRESH_TIME = 20_000
        this._log(`Auto fetching process will start in ${REFRESH_TIME / 1000} seconds`)

        this._intervalPairPriceFetch = setInterval(async () => {
            const count = failRequestHistory.count()
            await controller.refreshOrClearPair(this.options().priceFetchInterval())
            if (count < failRequestHistory.count())
                failRequestHistory.action().store()
        }, REFRESH_TIME)

        this._log('Pair price fetch interval is ' + this.options().priceFetchInterval() / 1000 + ' seconds')

        const removeInterval = this.options().removePriceHistoryInterval()
        if (removeInterval)
            this._intervalPairPriceHistoryRemove = setInterval(() => controller.purgePriceHistories(removeInterval), 60 * 60 * 1000) // 1 hour
        
        this._log('Price history remove interval is ', removeInterval > 0 ? removeInterval / 1000 + ' seconds' : 'never')
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