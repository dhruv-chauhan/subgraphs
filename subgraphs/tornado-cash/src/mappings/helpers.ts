import { Address, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreatePool, getOrCreateToken } from "../common/getters";
import { bigIntToBigDecimal } from "../common/utils/numbers";

export function createDeposit(event: ethereum.Event): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);
  let inputToken = getOrCreateToken(
    Address.fromString(pool.inputTokens[0]),
    event.block.number
  );

  pool.totalValueLockedUSD = pool.totalValueLockedUSD.plus(
    bigIntToBigDecimal(pool.denomination).times(inputToken.lastPriceUSD!)
  );
  // pool.cumulativeProtocolSideRevenueUSD
  // pool.cumulativeSupplySideRevenueUSD
  // pool.cumulativeTotalRevenueUSD
  pool.inputTokenBalances[0] = pool.inputTokenBalances[0].plus(
    pool.denomination
  );

  pool.save();
}

export function createWithdrawal(event: ethereum.Event): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);
  let inputToken = getOrCreateToken(
    Address.fromString(pool.inputTokens[0]),
    event.block.number
  );

  pool.totalValueLockedUSD = pool.totalValueLockedUSD.minus(
    bigIntToBigDecimal(pool.denomination).times(inputToken.lastPriceUSD!)
  );
  // pool.cumulativeProtocolSideRevenueUSD
  // pool.cumulativeSupplySideRevenueUSD
  // pool.cumulativeTotalRevenueUSD
  pool.inputTokenBalances[0] = pool.inputTokenBalances[0].minus(
    pool.denomination
  );

  pool.save();
}
