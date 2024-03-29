import { expect } from 'chai';
import fs from 'fs'
import { PolyPrice } from '../src/polyprice';
import LocalStorage from 'acey-node-store'

const DB_PATH = './.db'

const main = () => {

    fs.existsSync(DB_PATH) && fs.rmdirSync(DB_PATH, { recursive: true })
    fs.mkdirSync(DB_PATH)
    
    const poly = new PolyPrice({
        local_storage: new LocalStorage(DB_PATH)  
    })

    describe('PolyPrice class', async () => {

        it('Run', () => {
            poly.run()
        })
    })
}

main()