# Polyprice ⌚ : Real-time Crypto Price Tracker

<br />

Polyprice is a lightweight JavaScript library that tracks real-time prices of cryptocurrency pairs from centralized exchanges (CEX). 

It allows users to add a list of cryptocurrency pairs and fetch their prices regularly from CEXs smartly and independently. 

You don't have to worry about if your pairs are available on all the CEXes or even if they have the right format. (example : "USDT-BTC" will be handled correctly) 

### Why this library?

I hate API keys and I hate to reach the maximum requests allowed by a server in a timeframe.
But, I want to be consistently provided with the latest price data for a given pair. (In an elegant way and for free).

<br />


## Installation

```
yarn add polyprice
```

or

```
npm install polyprice
```


## Usage:
```typescript
import { Polyprice } from 'polyprice'

import LocalStorage from 'acey-node-store' //whatever local storage, could be the global "localStorage" in the browser

const poly = new PolyPrice({
    local_storage: new LocalStorage(DB_PATH), //to store the price history.
    interval_pair_price_request_ms: 60 * 1000 // 1 minute
})

//start the background process that refreshes the added pairs in the background.
poly.run()

//adding a pair
poly.addPair('BTC', 'USDT')
poly.addPair('ETH', 'USDT')
poly.addPair('LTC', 'USDT')

//remove a pair
poly.removePair('BTC', 'USDT')

//get pair last price
const pair = poly.findPair('BTC', 'USDT')
pair.lastPrice() // {cex:'binance', time: 1711864049, price: 70340.33}
```
