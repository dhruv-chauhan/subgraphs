import { Address, ethereum } from "@graphprotocol/graph-ts";
import { Protocol } from "../../generated/schema";
import { getOrCreatePool, getOrCreateToken } from "../common/getters";
import { bigIntToBigDecimal } from "../common/utils/numbers";
import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCash_eth/TornadoCash_eth";

export function createDeposit(event: Deposit): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);
  let inputToken = getOrCreateToken(
    Address.fromString(pool.inputTokens[0]),
    event.block.number
  );

  pool.totalValueLockedUSD = pool.totalValueLockedUSD.plus(
    bigIntToBigDecimal(pool._denomination).times(inputToken.lastPriceUSD!)
  );
  pool.inputTokenBalances[0] = pool.inputTokenBalances[0].plus(
    pool._denomination
  );

  pool.save();
}

export function createWithdrawal(event: Withdrawal): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);
  let inputToken = getOrCreateToken(
    Address.fromString(pool.inputTokens[0]),
    event.block.number
  );

  pool.totalValueLockedUSD = pool.totalValueLockedUSD.minus(
    bigIntToBigDecimal(pool._denomination).times(inputToken.lastPriceUSD!)
  );
  pool.cumulativeProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD.minus(
      pool._fee.times(bigIntToBigDecimal(pool._denomination))
    );

  // txn fee?
  pool.cumulativeSupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD.plus(
      bigIntToBigDecimal(event.params.fee).minus(pool._fee)
    );
  pool.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD.plus(
    pool.cumulativeProtocolSideRevenueUSD.plus(
      pool.cumulativeSupplySideRevenueUSD
    )
  );

  pool.inputTokenBalances[0] = pool.inputTokenBalances[0].minus(
    pool._denomination
  );

  pool.save();
}
