import { expect } from 'chai';
import fs from 'fs'
import { PolyPrice } from '../src/polyprice';
import LocalStorage from 'acey-node-store'
import { Pair } from '../src/models/pair';
import { newCexList } from '../src/models/cex';
import { CEX_LIST } from '../src/constant';
import { PriceHistoryList } from '../src/models/price-history';

const DB_PATH = './.db'

const main = () => {

    fs.existsSync(DB_PATH) && fs.rmdirSync(DB_PATH, { recursive: true })
    fs.mkdirSync(DB_PATH)
    
    const poly = new PolyPrice({
        local_storage: new LocalStorage(DB_PATH),  
        logging: true
    })
    
    const log = (...o: any) => console.log(...o)

    describe('PolyPrice class', async () => {

        // it('Run', () => {
        //     poly.run()
        // })

        // it('Try to add a pair', async () => {
        //     expect(poly.addPair('BTC', 'USDT')).to.be.instanceOf(Pair)
        // })

        // it('Try to fetch a pair', async () => {
        //     await poly.run()

        //     const pair = poly.addPair('BTC', 'USDT')
            
        //     const cexex = newCexList(CEX_LIST)

        //     const c = cexex.pickCEXForPair(pair)
        //     if (c){
        //         await c.fetchPrice(pair, new PriceHistoryList([], {connected: false}), log)
        //     }
        // })

    })
}

main()