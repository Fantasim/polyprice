import { Collection, IModelOptions, Model } from 'acey'
import { TCEX } from './cex'
import { Pair } from './pair'

interface IFailedHistory {
    pair_id: string
    time: number
    code: number
}

const DEFAULT_STATE: IFailedHistory = {
    pair_id: '',
    time: 0,
    code: 0
}

export class FailedHistory extends Model {
    
    constructor(state: IFailedHistory = DEFAULT_STATE, options: IModelOptions) {
        super(state, options)
    }

    get = () => {
        return {
            pairID: (): string => this.state.pair_id,
            time: (): Date => new Date(this.state.time * 1000),
            code: (): number => this.state.code
        }
    }
}

export class FailedHistoryList extends Collection {
    
    constructor(state: IFailedHistory[] | FailedHistory[] = [], options: IModelOptions) {
        super(state, [FailedHistory, FailedHistoryList], options)
    }

    add = (pair: Pair, cex: TCEX, code: number) => {
        const ph: IFailedHistory ={
            pair_id: `${pair.get().id()}-${cex}`,
            time: Date.now() / 1000,
            code: code
        }
        
        return this.push(ph)
    }
}

export const failedRequestHistory = new FailedHistoryList([], {key: 'fail-history', connected: true})