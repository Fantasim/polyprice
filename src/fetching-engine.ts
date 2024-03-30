import { ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, MAX_REQUESTS_REACHED_ERROR_CODE, UNABLE_TO_PARSE_PRICE_ERROR_CODE, UNABLE_TO_REACH_SERVER_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from "./constant";
import { CEX } from "./models/cex";
import { failRequestHistory } from "./models/fail-history";
import { Pair } from "./models/pair";
import { fetchWithTimeout, safeParsePrice } from "./utils";

export const fetchPrice = async (cex: CEX,  pair: Pair, log?: (o: any) => void) => {
    const endpointURL = cex.get().endpoint(pair);
    const abortController = new AbortController();
    
    const timeoutMs = 5000; // Timeout duration in milliseconds
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
        // this._requestCount++;
        log && log(`Fetching price from ${cex.get().name()} for ${pair.get().id()}`);

        const response = await fetchWithTimeout(endpointURL, abortController.signal, log);
        const result = await handleResponse(cex, response as any, pair, log);

        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        return handleError(cex, error, pair, log);
    }
}

const handleResponse = async (cex: CEX, response: Response, pair: Pair, log?: (o: any) => void) => {
    if (response.status === 200) {
        return await parseResponse(cex, response, pair, log);
    } else {
        return await handleNon200Response(cex, response, pair, log);
    }
}

const parseResponse = async (cex: CEX, response: Response, pair: Pair, log?: (o: any) => void) => {
    const json = await response.json() as any;
    let unparsedPrice;
    let code: number = 200;

    switch (cex.get().name()) {
        case 'binance':
        case 'coinbase':
            unparsedPrice = json.price;
            break;
        case 'kraken':
            if (json.error && json.error.length > 0){
                code = UNFOUND_PAIR_ERROR_CODE;
                break;
            }
            const keys = Object.keys(json.result);
            unparsedPrice = json.result[keys[0]].c[0];
            break;
        case 'gemini':
            unparsedPrice = json.last;
            break;
        case 'kucoin':
            if (!!json.data)
                unparsedPrice = json.data.price;
            else
                code = UNFOUND_PAIR_ERROR_CODE;
            break;
    }

    const priceOrError = safeParsePrice(unparsedPrice);
    if (typeof priceOrError === 'number' && code === 200) {
        log && log(`New price from ${cex.get().name()} for ${pair.get().id()}: ${priceOrError}`);
        pair.get().priceHistoryList().add(priceOrError, cex.get().name()).store();
        return {cex: cex.get().name(), price: priceOrError}
    } else {
        failRequestHistory.add(pair, cex.get().name(), code === 200 ? UNABLE_TO_PARSE_PRICE_ERROR_CODE : code, log)
        return code
    }
}

const handleNon200Response = async (cex: CEX, response: Response, pair: Pair, log?: (o: any) => void) => {
    switch (response.status) {
        case 429:
            cex.setDisabledUntil(Date.now() + 60 * 1000) // 1 minute
            return MAX_REQUESTS_REACHED_ERROR_CODE
        case 400:
            failRequestHistory.add(pair, cex.get().name(), UNFOUND_PAIR_ERROR_CODE, log);
            return UNFOUND_PAIR_ERROR_CODE
        case 404:
            if (cex.get().name() === 'coinbase') {
                const json = await response.json() as any;
                const keys = Object.keys(json);
                if (keys[0] === 'message' && json[keys[0]] === 'NotFound') {
                    failRequestHistory.add(pair, cex.get().name(), UNFOUND_PAIR_ERROR_CODE, log);
                    return UNFOUND_PAIR_ERROR_CODE
                } else if (keys[0] === 'message' && json[keys[0]] === 'Unauthorized.' || json[keys[0]] === 'Route not found') {
                    failRequestHistory.add(pair, cex.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, log);
                    return ENDPOINT_DOES_NOT_EXIST_ERROR_CODE
                }
            }
            failRequestHistory.add(pair, cex.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, log)
            return ENDPOINT_DOES_NOT_EXIST_ERROR_CODE
        case 401:
            failRequestHistory.add(pair, cex.get().name(), ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, log);
            return ENDPOINT_DOES_NOT_EXIST_ERROR_CODE
    }
    return response.status
}

const handleError = (cex: CEX, error: any, pair: Pair, log?: (o: any) => void) => {
    if (error.name === 'AbortError') {
        failRequestHistory.add(pair, cex.get().name(), UNABLE_TO_REACH_SERVER_ERROR_CODE, log);
        return UNABLE_TO_REACH_SERVER_ERROR_CODE
    } else {
        log && log(`Fetch error from ${cex.get().name()} for ${pair.get().id()}: ${error.message}`);
        return UNABLE_TO_REACH_SERVER_ERROR_CODE
    }
}
