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