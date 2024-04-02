import { expect } from 'chai';
import fs from 'fs'
import { PolyPrice, controller } from '../src/polyprice';
import LocalStorage from 'acey-node-store'
import { Pair } from '../src/models/pair';
import { CEX, TCEX, newCexList } from '../src/models/cex';
import { CEX_LIST, CEX_PRICE_ENDPOINTS, ENDPOINT_DOES_NOT_EXIST_ERROR_CODE, UNFOUND_PAIR_ERROR_CODE } from '../src/constant';
import { PriceHistory, PriceHistoryList } from '../src/models/price-history';
import { FailHistory, failRequestHistory } from '../src/models/fail-history';

import { runExchangeTests } from './exchange'

const DB_PATH = './.db'

const poly = new PolyPrice({
    local_storage: new LocalStorage(DB_PATH),  
    logging: 'new-price-only',
})



const main = () => {

    describe('Instance', async () => {

        it('Clearing DB', async () => {
            fs.existsSync(DB_PATH) && fs.rmdirSync(DB_PATH, { recursive: true })
            fs.mkdirSync(DB_PATH)
        })

        it('Poly sync DB', async () => {
            await poly.run(5000_000, 1.0)
        })
    })

    runExchangeTests(poly)

    describe('Smart system', async () => {
        it('Adding a fetching reversed pair (USDT-ETH)', async () => {
            const { cexList, pairList } = controller
            const initilFailHistoryCount = failRequestHistory.count()

            const pair = poly.addPair('USDT', 'ETH') as Pair
            const totalPairs = pairList.count()

            expect(pair).to.be.instanceOf(Pair)
            expect(pair.get().id()).to.eq('usdt-eth')
            expect(pair.get().priceHistoryList().count()).to.eq(0)

            const CEX_LIST_COUNT = cexList.count()
            for (let i = 0; i < CEX_LIST_COUNT; i++){
                const cex = cexList.nodeAt(i) as CEX
                //we reanabled the cex
                cex.setDisabledUntil(0)
                
                failRequestHistory.add(pair, cex.get().name(), UNFOUND_PAIR_ERROR_CODE)

                const f = failRequestHistory.first() as FailHistory
                expect(f).to.be.instanceOf(FailHistory)
                expect(f.get().pairID()).to.eq('usdt-eth-' + cex.get().name())
                expect(f.get().code()).to.eq(UNFOUND_PAIR_ERROR_CODE)
                expect(failRequestHistory.count()).to.eq(initilFailHistoryCount + i + 1)


                if (i+1 < CEX_LIST_COUNT){
                    expect(pair.isTrash()).to.be.false
                    expect(pairList.count()).to.eq(totalPairs)
                    expect(pairList.findByPair("usdt", "eth")).to.be.instanceOf(Pair)
                    expect(pairList.findByPair("eth", "usdt")).to.be.undefined
                } else {
                    expect(pair.isTrash()).to.be.true
                    expect(pairList.count()).to.eq(totalPairs)
                    expect(pairList.findByPair("usdt", "eth")).to.be.undefined
                    expect(pairList.findByPair("eth", "usdt")).to.be.instanceOf(Pair)
                }
            }
        })

        it ('Check CEX picking for pair fetching', () => {
            const { cexList } = controller

            const pair = poly.addPair('LINK', 'USDT') as Pair
            expect(pair).to.be.instanceOf(Pair)
            expect(pair.get().id()).to.eq('link-usdt')
            expect(pair.get().priceHistoryList().count()).to.eq(0)
            const CEX_LIST_COUNT = cexList.count()
            
            const availableCEXes: TCEX[] = []
            for (let i = 0; i < CEX_LIST_COUNT; i++){
                const cex = cexList.nodeAt(i) as CEX
                cex.setDisabledUntil(0)

                if (i % 2 === 0){
                    pair.get().priceHistoryList().add(18.55, cex.get().name()).store()
                    availableCEXes.push(cex.get().name())
                } else {
                    failRequestHistory.add(pair, cex.get().name(), UNFOUND_PAIR_ERROR_CODE).store()
                }
            }
            const availableCEXes2 = cexList.filterAvailableCEXForPair(pair)
            expect(availableCEXes2.count()).to.eq(availableCEXes.length)
            availableCEXes2.map((cex: CEX) => {
                expect(availableCEXes).to.include(cex.get().name())
            })
        })
    })

}

main()

