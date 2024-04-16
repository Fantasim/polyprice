import {config, manager }from 'acey'
import { CEX, CEXList, TCEX, newCexList } from './models/cex'
import { Pair, PairList } from './models/pair'
import { PriceHistoryList } from './models/price-history'
import { CEX_LIST, FETCH_BATCH_SIZE } from './constant'
import { failRequestHistory } from './models/fail-history'
import _ from 'lodash'

class Controller {

    private _logging: 'none' | 'new-price-only' | 'all' = 'none'
    public cexList: CEXList
    public pairList: PairList = new PairList([], {key: 'polyprice-pairs', connected: true})
    public priceHistoryMap: {[key: string]: PriceHistoryList} = {}
    private _onPriceUpdate?: (symbol0: string, symbol1: string, price: number) => void 

    private _fetchingSettings: {max_request_count_per_second: number, min_fetch_interval_ms: number} | null = null

    constructor(){
        this.cexList = newCexList(CEX_LIST)

        this.pairList.watch().localStoreFetch(() => {
            this.pairList.forEach((pair) => {
                const history = new PriceHistoryList([], {key: 'polyprice-'+pair.get().id(), connected: true})
                manager.connectModel(history)
                this.priceHistoryMap[pair.get().id()] = history
            })
            this.printRegularLog('Price history loaded from local storage')
        })
    }

    printRegularLog = (...msg: any) => {
        if (this._logging === 'all')
            console.log(...msg)
    }

    getMaxRequestCountPerSecond = () => {
        return this._fetchingSettings?.max_request_count_per_second || 1
    }

    getMinFetchInterval = () => {
        return this._fetchingSettings?.min_fetch_interval_ms || 1000
    }

    setFetchingSettings = (max_request_count_per_second: number, min_fetch_interval_ms: number) => {
        this._fetchingSettings = {
            max_request_count_per_second: Math.max(Math.min(CEX_LIST.length, max_request_count_per_second), 0.05), 
            min_fetch_interval_ms: Math.max(min_fetch_interval_ms, 1000)
        }
    }

    private _printPriceLog = (symbol0: string, symbol1: string, price: number, cex: TCEX) => {
        if (this._logging === 'new-price-only' || this._logging === 'all'){
            const colorMap: { [key: string]: string } = {}; // Map to store color for each symbol
            const symbols = [symbol0, symbol1];
    
            // Assign unique colors to each symbol based on its name
            symbols.forEach((symbol, index) => {
                const colors = ['31', '32', '33', '34', '35', '36']; // ANSI color codes for red, green, yellow, blue, magenta, cyan
                colorMap[symbol] = colors[index % colors.length];
            });
    
            // Get current time
            const currentTime = `\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m`; // Grey color for time stamp
    
            // Construct the log message with color formatting for symbols
            const logMessage = `[\x1b[90m${cex}\x1b[0m : ${currentTime}] 1 \x1b[38;5;${colorMap[symbol0]}m${symbol0} \x1b[0m= \x1b[1m${price.toFixed(4)} \x1b[38;5;${colorMap[symbol1]}m${symbol1}\x1b[0m`;
    
            // Print the log message
            console.log(logMessage);
        }
    }

    setCEXList = (ignore_cexes: TCEX[]) => {
        const filteredList = CEX_LIST.filter((cex) => !ignore_cexes.includes(cex))
        this.cexList.deleteBy((cex: CEX) => !filteredList.includes(cex.get().name()))
    }

    onPriceUpdate = (symbol0: string, symbol1: string, price: number, cex: TCEX) => {
        this._printPriceLog(symbol0, symbol1, price, cex)
        this._onPriceUpdate && this._onPriceUpdate(symbol0, symbol1, price)
    }

    setOnPriceUpdate = (onPriceUpdate: (symbol0: string, symbol1: string, price: number) => void) => {
        this._onPriceUpdate = onPriceUpdate
    }

     purgePriceHistories = (rmPairPriceHistoryInterval: number) => {
        if (rmPairPriceHistoryInterval > 0){
            for (const key in this.priceHistoryMap){
                this.priceHistoryMap[key].removePriceBeforeTime(Date.now() - rmPairPriceHistoryInterval)
            }
        }
        this.printRegularLog('old price history purged')
    }
    
    removeAllPairs = () => {
        this.pairList.setState([])
        for (const key in this.priceHistoryMap){
            this.priceHistoryMap[key].setState([])
        }
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
        const history = new PriceHistoryList([], {key: 'polyprice-' + pair.get().id(), connected: true})
        // manager.connectModel(history)
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
            this.printRegularLog(`Pair ${key} removed`)

            delete this.priceHistoryMap[key]
            //remove the price history from the local storage
            manager.localStoreManager().removeKey('polyprice-' + key)

            this.printRegularLog(`Price history of ${pair.get().id()} removed`)

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


    refreshOrClearPair = (list: PairList) => {
        const ret: Promise<number | {
            cex: TCEX;
            price: number;
        } | null>[] = []
        for (let i = 0; i < list.count(); i++){
            const pair = list.nodeAt(i) as Pair
            const prom = pair.fetchLastPriceIfNeeded()
            prom ? ret.push(prom) : ret.push(Promise.resolve(null))
        }
        return ret
    }

    setLogging = (logging: 'none' | 'new-price-only' | 'all') => {
        this._logging = logging
    }

}

export const controller = new Controller()

export interface PolyPriceOptions {
    local_storage?: any
    //cexes to ignore
    ignore_cexes?: TCEX[]
    //default: 0 (never)
    price_history_expiration_ms?: number
    logging?: 'none' | 'new-price-only' | 'all',
}

const DEFAULT_OPTIONS: PolyPriceOptions = {
    price_history_expiration_ms: 0,
    ignore_cexes: [],
    logging: 'new-price-only',
    local_storage: undefined
}

export class PolyPrice {

    private _running = false
    private _options: PolyPriceOptions
    private _intervalPairPriceFetch: any
    private _intervalPairPriceHistoryRemove: any
    private _cpuOtimizationEnabled = false

    private _log = (...msg: any) => {
        if (this.options().fullLogginEnabled())
            console.log(...msg)
    }

    private options = () => {
        return {
            removePriceHistoryInterval: () => Math.max(this._options.price_history_expiration_ms || 0, 0), // 0 means never
            fullLogginEnabled: () => this._options.logging === 'all',
            disactivedCEXes: () => this._options.ignore_cexes || [],
        }
    }

    constructor(options: PolyPriceOptions, onPriceUpdate?: (symbol0: string, symbol1: string, price: number) => void){
        options.local_storage && config.setStoreEngine(options.local_storage)
        this._options = Object.assign({}, DEFAULT_OPTIONS, options)
        
        controller.setCEXList(this.options().disactivedCEXes())
        controller.setLogging(this._options.logging || 'new-price-only')
        onPriceUpdate && controller.setOnPriceUpdate(onPriceUpdate)
    }

    /* Enable CPU optimization to reduce the number of storage operations
        If enabled, the price and fail history won't be be updated in the local storage
        you'd have to call updateDataInJSON() to update the data in the local storage
    */
    enableCPUOptimization = () => {
        this._cpuOtimizationEnabled = true
    }

    updateDataInJSON = async () => {
        return Promise.allSettled([failRequestHistory.action().store(), ...controller.pairList.map((pair) => {
            return pair.get().priceHistoryList().action().store()
        })])
    }

    clearFailHistory = async (areYouSure: boolean) => {
        if (areYouSure){
            await failRequestHistory.setState([]).store()
            this._log('Fail history erased')
        }
    }

    addPair = controller.addPair
    removePair = controller.removePair
    findPair = (symbol0: string, symbol1: string): Pair | null => controller.pairList.findByPair(symbol0, symbol1) || null
    allPairsWithSymbol = (symbol: string) => controller.pairList.filterBySymbol(symbol)

    private _runIntervals = () => {
        const interval = (1 / controller.getMaxRequestCountPerSecond()) * FETCH_BATCH_SIZE

        this._intervalPairPriceFetch = setInterval(async () => {
            
            let hasFailedOnce = false
            const selectedPairs = controller.pairList.filterByPriceFetchRequired().slice(0, FETCH_BATCH_SIZE) as PairList
            const res = await Promise.allSettled(controller.refreshOrClearPair(selectedPairs))
            
            if (!this._cpuOtimizationEnabled){
                res.forEach((r, idx: number) => {
                    if (r && typeof r === 'object')
                        (selectedPairs.nodeAt(idx) as Pair).get().priceHistoryList().action().store()
                    else if (typeof r === 'number')
                        hasFailedOnce = true                
                })
                hasFailedOnce && failRequestHistory.action().store()
            }

        }, interval * 1000)

        this._log('Min pair price fetch interval is ' + (controller.getMinFetchInterval() / 1000).toFixed(1) + ' seconds')

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

    removeAllPairs = controller.removeAllPairs

    run = async (minFetchInterval: number, maxRequestCountPerSecond: number) => {
        if (this._running)
            return
        await config.done()
        this._running = true
        controller.setFetchingSettings(maxRequestCountPerSecond, minFetchInterval)
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