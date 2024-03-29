import { TCEX } from "./models/cex"

export const UNABLE_TO_PARSE_PRICE_ERROR_CODE = 999
export const UNFOUND_PAIR_ERROR_CODE = 400
export const ENDPOINT_DOES_NOT_EXIST_ERROR_CODE = 404
export const UNABLE_TO_REACH_SERVER_ERROR_CODE = 500


export const RETRY_LOOKING_FOR_PAIR_INTERVAL = 30 * 24 * 60 * 60 * 1000 // 30 days

export const CEX_LIST: TCEX [] = ['binance', 'coinbase', 'kraken', 'gemini', 'kucoin']