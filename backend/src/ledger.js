import { HttpError } from './errors.js'

const indicativeKesPrices = { SCOM: 28.4, KCB: 47.2, EQTY: 61.5, 'T-BILL-91': 98.7 }

export function assertSellWithinHoldings(heldQuantity, requestedQuantity, instrument) {
  if (requestedQuantity > heldQuantity + Number.EPSILON) {
    throw new HttpError(
      422,
      'INSUFFICIENT_HOLDINGS',
      `You hold ${heldQuantity} ${instrument}; reduce the sell quantity or add a buy first.`,
      { instrument, heldQuantity, requestedQuantity },
    )
  }
}

export function calculateHoldings(transactions, currency) {
  const currencyRate = currency === 'USD' ? 1 / 129 : 1
  const balances = new Map()
  for (const transaction of transactions) {
    const balance = balances.get(transaction.instrument) ?? { quantity: 0, cost: 0 }
    if (transaction.type === 'BUY') {
      balance.quantity += transaction.quantity
      balance.cost += transaction.quantity * transaction.unitPrice
    } else {
      const averageCost = balance.quantity > 0 ? balance.cost / balance.quantity : 0
      balance.quantity -= transaction.quantity
      balance.cost -= averageCost * transaction.quantity
    }
    balances.set(transaction.instrument, balance)
  }
  return [...balances.entries()]
    .filter(([, balance]) => balance.quantity > 0.000001)
    .map(([instrument, balance]) => {
      const averageCost = balance.cost / balance.quantity
      const marketPrice = indicativeKesPrices[instrument]
      return {
        instrument,
        quantity: balance.quantity,
        averageCost,
        totalInvested: balance.cost,
        totalValue: balance.quantity * (marketPrice ? marketPrice * currencyRate : averageCost),
      }
    })
}
