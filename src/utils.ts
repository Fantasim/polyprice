import fetch from "node-fetch-native";

export const areSymbolsEqual = (symbol1: string, symbol2: string) => {
    return symbol1.toLowerCase() === symbol2.toLowerCase()
  }

export const safeParsePrice = (price: any) =>{
    if (typeof price === 'number' && !isNaN(price)){
        return price 
    }
    if (typeof price === 'string'){
        const p = parseFloat(price)
        if (!isNaN(p)){
            return p
        }
    }
    return 'price is not a number'
}

export const buildKey = (symbol0: string, symbol1: string) => {
    return symbol0.toLowerCase() + '-' + symbol1.toLowerCase()
}

export const fetchWithTimeout = async (endpointURL: string, signal: AbortSignal, log?: (o: any) => void) => {
    return Promise.race([
        fetch(endpointURL, { signal }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
}