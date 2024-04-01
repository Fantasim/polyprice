import { TCEX } from "./models/cex"

//error codes
export const UNABLE_TO_PARSE_PRICE_ERROR_CODE = 999
export const UNFOUND_PAIR_ERROR_CODE = 400
export const ENDPOINT_DOES_NOT_EXIST_ERROR_CODE = 404
export const MAX_REQUESTS_REACHED_ERROR_CODE = 429
export const UNABLE_TO_REACH_SERVER_ERROR_CODE = 500

//if pair is not found on an exchange, retry looking for it after this interval
export const RETRY_LOOKING_FOR_PAIR_INTERVAL = 30 * 24 * 60 * 60 * 1000 // 30 days

export const FETCH_BATCH_SIZE = 5

//CEX
export const CEX_LIST: TCEX [] = ['binance', 'coinbase', 'kraken', 'gemini', 'kucoin']
export const CEX_PRICE_ENDPOINTS: { [key in TCEX]: (symbol0: string, symbol1: string) => string } = {
    binance: (symbol0, symbol1) => `https://api.binance.com/api/v3/ticker/price?symbol=${symbol0}${symbol1}`,
    coinbase: (symbol0, symbol1) => `https://api.pro.coinbase.com/products/${symbol0}-${symbol1}/ticker`,
    kraken: (symbol0, symbol1) => `https://api.kraken.com/0/public/Ticker?pair=${symbol0}${symbol1}`,
    gemini: (symbol0, symbol1) => `https://api.gemini.com/v1/pubticker/${symbol0.toLowerCase()}${symbol1.toLowerCase()}`,
    kucoin: (symbol0, symbol1) => `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol0}-${symbol1}`
}