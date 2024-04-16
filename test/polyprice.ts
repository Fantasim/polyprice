import { expect } from "chai";
import { PolyPrice, controller } from "../src/polyprice";
import { Pair } from "../src/models/pair";
import { PriceHistory, PriceHistoryList } from "../src/models/price-history";
import { CEX, CEXList, TCEX } from "../src/models/cex";
import { FailHistory, failRequestHistory } from "../src/models/fail-history";
import { CEX_PRICE_ENDPOINTS, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from "../src/constant";

// const generalExpectationsPriceFetchAfterSuccess = (pair: Pair, cex: TCEX, r: { cex: TCEX, price: number }, priceListCount: number) => {
//     const { cex: cexName, price } = r as any
//     expect(cex).to.eq(cexName)
//     expect(price).to.be.a('number').above(0)
    
//     const priceList = pair.get().priceHistoryList() as PriceHistoryList
//     const ph = pair.get().priceHistoryList().first() as PriceHistory
//     expect(ph.get().price()).to.eq(price)
//     expect(ph.get().cex()).to.eq(cex)
//     expect(priceList.count()).to.eq(priceListCount)
// }

// const generalExpectationsPriceFetchAfterFailure = (pair: Pair, cex: TCEX, r: number, code: number, failListCount: number) => {
//     expect(r).to.eq(code)
//     const last = failRequestHistory.first() as FailHistory
//     expect(last.get().code()).to.eq(code)
//     expect(last.get().pairID()).to.eq(pair.get().id() + '-' + cex)
//     expect(failRequestHistory.count()).to.eq(failListCount)
// }



export const runPolyPriceTest = (poly: PolyPrice) => {
    describe('PolyPrice', () => {

        it('Not mainstream token', async () => {
            poly.stop()
            poly.removeAllPairs()
            poly.addPair('CTSI', 'USDT')
            await poly.run(1_000, 2)

            let pair: Pair | null = null
            for (let i = 0; i < 15; i++){
                //sleep 1 sec
                await new Promise(resolve => setTimeout(resolve, 1000))
                pair = poly.findPair('CTSI', 'USDT') as Pair
                if (!pair) 
                    break
                if (pair.get().priceHistoryList().count() > 0){
                    break
                }
            }
            if (!pair){
                throw new Error('Pair not found')
            }
            const ph = pair.get().priceHistoryList().first() as PriceHistory
            expect(ph.get().price()).to.be.a('number').above(0)
            poly.stop()
            poly.removeAllPairs()

        })

    })
}