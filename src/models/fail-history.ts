import { Collection, IModelOptions, Model } from 'acey'
import { TCEX } from './cex'
import { Pair } from './pair'
import { UNFOUND_PAIR_ERROR_CODE } from '../constant'
import { controller } from '../polyprice'

interface IFailHistory {
    pair_id: string
    time: number
    code: number
}

const DEFAULT_STATE: IFailHistory = {
    pair_id: '',
    time: 0,
    code: 0
}

export class FailHistory extends Model {
    
    constructor(state: IFailHistory = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            pairID: (): string => this.state.pair_id,
            time: (): Date => new Date(this.state.time * 1000),
            code: (): number => this.state.code
        }
    }

    wasItMoreThanATimeAgo = (time: number) => {
        return (Date.now() - this.get().time().getTime()) > time
    }

    wasItMoreThan60MinutesAgo = () => {
        return (Date.now() - this.get().time().getTime()) > 60 * 60 * 1000 // 1 hour
    }

    wasItMoreThan15MinutesAgo = () => {
        return (Date.now() - this.get().time().getTime()) > 15 * 60 * 1000 // 15 minutes
    }
}

export class FailHistoryList extends Collection {
    
    constructor(state: IFailHistory[] | FailHistory[] = [], options: IModelOptions) {
        super(state, [FailHistory, FailHistoryList], options)
    }

    findLastByPairID = (pair_id: string) => {
        return this.find((FailHistory: FailHistory) => {
            return FailHistory.get().pairID().startsWith(pair_id)
        }) as FailHistory
    }

    filterByPairAndCodeAfterTime = (pair: Pair, code: number, after: number) => {
        return this.filter((failHistory: FailHistory) => {
            return failHistory.get().code() === code && failHistory.get().pairID().startsWith(pair.get().id()) && failHistory.get().time().getTime() > after
        }) as FailHistoryList
    }

    uniqueCEXes = () => {
        const obj: {[key: string]: boolean} = {}
        this.map((fh: FailHistory) => {
            const s = fh.get().pairID().split('-')
            obj[s[s.length - 1].toLowerCase() as TCEX] = true
        })
        
        return Object.keys(obj) as TCEX[]
    }

    add = (pair: Pair, cex: TCEX, code: number) => {
        const ph: IFailHistory ={
            pair_id: `${pair.get().id()}-${cex}`,
            time: Math.floor(Date.now() / 1000),
            code: code
        }

        controller.printRegularLog(`Fail history added for ${pair.get().id()} with code ${code}`)
        const action = this.prepend([ph])

        //if the pair has not been found anywhere, we remove it
        if (code === UNFOUND_PAIR_ERROR_CODE && pair.isTrash()){
            controller.printRegularLog(`Pair ${pair.get().id()} detecte as trash...`)
            controller.removePair(pair.get().symbol0(), pair.get().symbol1(), true)
        }

        return action
    }
}

export const failRequestHistory = new FailHistoryList([], {key: 'polyprice-fail-history', connected: true})