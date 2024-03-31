import { expect } from "chai";
import { PolyPrice, controller } from "../src/polyprice";
import { Pair } from "../src/models/pair";
import { PriceHistory, PriceHistoryList } from "../src/models/price-history";
import { CEX, TCEX } from "../src/models/cex";
import { FailHistory, failRequestHistory } from "../src/models/fail-history";
import { CEX_PRICE_ENDPOINTS, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from "../src/constant";

const generalExpectationsPriceFetchAfterSuccess = (pair: Pair, cex: TCEX, r: { cex: TCEX, price: number }, priceListCount: number) => {
    const { cex: cexName, price } = r as any
    expect(cex).to.eq(cexName)
    expect(price).to.be.a('number').above(0)
    
    const priceList = pair.get().priceHistoryList() as PriceHistoryList
    const ph = pair.get().priceHistoryList().first() as PriceHistory
    expect(ph.get().price()).to.eq(price)
    expect(ph.get().cex()).to.eq(cex)
    expect(priceList.count()).to.eq(priceListCount)
}

const generalExpectationsPriceFetchAfterFailure = (pair: Pair, cex: TCEX, r: number, code: number, failListCount: number) => {
    expect(r).to.eq(code)
    const last = failRequestHistory.first() as FailHistory
    expect(last.get().code()).to.eq(code)
    expect(last.get().pairID()).to.eq(pair.get().id() + '-' + cex)
    expect(failRequestHistory.count()).to.eq(failListCount)
}

const log = (...o: any) => console.log(...o)

export const runExchangeTests = (poly: PolyPrice) => {


    describe('Coinbase', () => {
        let COUNT = 1

        const { cexList } = controller
        const NAME: TCEX = 'coinbase'
        const exchange = cexList.findByName(NAME) as CEX

        it('BTC-USDT', async () => {
            //BTC-USDT
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            expect(r).to.not.be.instanceOf(Number)
            generalExpectationsPriceFetchAfterSuccess(pair, NAME, r as any, COUNT)
        })

        it('XXK-YYQ (non existant)', async () => {
            //UNEXISTING PAIR
            const pair = poly.addPair('YYY', 'WWW') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, UNFOUND_PAIR_ERROR_CODE, COUNT * 2 - 1)
        })

        it('wrong endpoint', async () => {
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            CEX_PRICE_ENDPOINTS[NAME] = (symbol0, symbol1) => `https://api.pro.coinbase.com/or/what/blabla/${symbol0}-${symbol1}`
            const r = await exchange.fetchLastPrice(pair, log)
            failRequestHistory.action().store()
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, COUNT * 2)
            expect(exchange.isDisabled()).to.eq(true)
            expect(failRequestHistory.uniqueCEXes().length).to.eq(COUNT)

        })
    })

    describe('Binance', () => {
        let COUNT = 2

        const { cexList } = controller
        const NAME: TCEX = 'binance'
        const exchange = cexList.findByName(NAME) as CEX

        it('BTC-USDT', async () => {
            //BTC-USDT
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            expect(r).to.not.be.instanceOf(Number)
            generalExpectationsPriceFetchAfterSuccess(pair, NAME, r as any, COUNT)
        })

        it('XXK-YYQ (non existant)', async () => {
            //UNEXISTING PAIR
            const pair = poly.addPair('YYY', 'WWW') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, UNFOUND_PAIR_ERROR_CODE, COUNT * 2 - 1)
        })

        it('wrong endpoint', async () => {
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            CEX_PRICE_ENDPOINTS[NAME] = (symbol0, symbol1) => `https://api.binance.com/or/what/blabla/${symbol0}-${symbol1}`
            const r = await exchange.fetchLastPrice(pair, log)
            failRequestHistory.action().store()
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, COUNT * 2)
            expect(exchange.isDisabled()).to.eq(true)
            expect(failRequestHistory.uniqueCEXes().length).to.eq(2)
        })
    })

    describe('Kraken', () => {
        let COUNT = 3

        const { cexList } = controller
        const NAME: TCEX = 'kraken'
        const exchange = cexList.findByName(NAME) as CEX

        it('BTC-USDT', async () => {
            //BTC-USDT
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            expect(r).to.not.be.instanceOf(Number)
            generalExpectationsPriceFetchAfterSuccess(pair, NAME, r as any, COUNT)
        })

        it('XXK-YYQ (non existant)', async () => {
            //UNEXISTING PAIR
            const pair = poly.addPair('YYY', 'WWW') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, UNFOUND_PAIR_ERROR_CODE, COUNT * 2 - 1)
        })

        it('wrong endpoint', async () => {
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            CEX_PRICE_ENDPOINTS[NAME] = (symbol0, symbol1) => `https://api.kraken.com/or/what/blabla/${symbol0}-${symbol1}`
            const r = await exchange.fetchLastPrice(pair, log)
            failRequestHistory.action().store()
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, COUNT * 2)
            expect(exchange.isDisabled()).to.eq(true)
            expect(failRequestHistory.uniqueCEXes().length).to.eq(COUNT)
        })
    })

    describe('Gemini', () => {
        let COUNT = 4

        const { cexList } = controller
        const NAME: TCEX = 'gemini'
        const exchange = cexList.findByName(NAME) as CEX

        it('BTC-USDT', async () => {
            //BTC-USDT
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            expect(r).to.not.be.instanceOf(Number)
            generalExpectationsPriceFetchAfterSuccess(pair, NAME, r as any, COUNT)
        })

        it('XXK-YYQ (non existant)', async () => {
            //UNEXISTING PAIR
            const pair = poly.addPair('YYY', 'WWW') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, UNFOUND_PAIR_ERROR_CODE, COUNT * 2 - 1)
        })

        it('wrong endpoint', async () => {
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            CEX_PRICE_ENDPOINTS[NAME] = (symbol0, symbol1) => `https://api.gemini.com/or/what/blabla/${symbol0}-${symbol1}`
            const r = await exchange.fetchLastPrice(pair, log)
            failRequestHistory.action().store()
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, COUNT * 2)
            expect(exchange.isDisabled()).to.eq(true)
            expect(failRequestHistory.uniqueCEXes().length).to.eq(COUNT)
        })
    })

    describe('Kucoin', () => {
        let COUNT = 5

        const { cexList } = controller
        const NAME: TCEX = 'kucoin'
        const exchange = cexList.findByName(NAME) as CEX

        it('BTC-USDT', async () => {
            //BTC-USDT
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            expect(r).to.not.be.instanceOf(Number)
            generalExpectationsPriceFetchAfterSuccess(pair, NAME, r as any, COUNT)
        })

        it('XXK-YYQ (non existant)', async () => {
            //UNEXISTING PAIR
            const pair = poly.addPair('YYY', 'WWW') as Pair
            expect(pair).to.be.instanceOf(Pair)

            const r = await exchange.fetchLastPrice(pair, log)
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, UNFOUND_PAIR_ERROR_CODE, COUNT * 2 - 1)
        })

        it('wrong endpoint', async () => {
            const pair = poly.addPair('BTC', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)

            CEX_PRICE_ENDPOINTS[NAME] = (symbol0, symbol1) => `https://api.kucoin.com/or/what/blabla/${symbol0}-${symbol1}`
            const r = await exchange.fetchLastPrice(pair, log)
            failRequestHistory.action().store()
            generalExpectationsPriceFetchAfterFailure(pair, NAME, r as any, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, COUNT * 2)
            expect(exchange.isDisabled()).to.eq(true)
            expect(failRequestHistory.uniqueCEXes().length).to.eq(COUNT)
        })
    })

}