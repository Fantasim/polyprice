# Polyprice ⌚ : Real-time Crypto Price Tracker

Polyprice is a lightweight JavaScript library designed to track real-time prices of various cryptocurrency pairs from centralized exchanges (CEX). It allows users to specify a list of cryptocurrency pairs and fetches their prices regularly from CEXs in a randomized manner. This approach ensures that the library never reaches the maximum request limit imposed by the exchanges while consistently providing the latest price data for a given token.

## Key Features:
- **Real-time tracking:** Polyprice fetches and updates cryptocurrency prices in real-time, ensuring users have access to the latest market data.
- **Centralized exchange support:** The library supports fetching prices from popular centralized exchanges, providing a wide range of trading pairs.
- **Randomized fetching:** Polyprice fetches price data from exchanges in a randomized manner to avoid exceeding the request limits imposed by the exchanges.
- **Lightweight and efficient:** Polyprice is designed to be lightweight and efficient, minimizing resource consumption while delivering reliable price tracking functionality.

## Usage:
1. Specify the list of cryptocurrency pairs to track.
2. Initialize the Polyprice library with the specified pairs.
3. Polyprice will automatically fetch and update the prices of the specified pairs at regular intervals.
4. Access the latest price data for any token pair through the provided APIs.

### Example:
```javascript
const pairs = ['BTC/USD', 'ETH/USD', 'XRP/USD']; // List of cryptocurrency pairs
const polyprice = new Polyprice(pairs);

polyprice.on('priceUpdate', (pair, price) => {
  console.log(`Latest price of ${pair}: ${price}`);
});
