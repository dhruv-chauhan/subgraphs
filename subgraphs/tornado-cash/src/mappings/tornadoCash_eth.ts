import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCash_eth/TornadoCash_eth";
import { getOrCreatePool, getOrCreateProtocol } from "../common/getters";
import { log } from "@graphprotocol/graph-ts";

export function handleDeposit(event: Deposit): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);

  // update tvl, input balance
  // pool.totalValueLockedUSD =
  // pool.cumulativeProtocolSideRevenueUSD
  // pool.cumulativeSupplySideRevenueUSD
  // pool.cumulativeTotalRevenueUSD
  // pool.inputTokenBalances

  pool.save();

  // update snapshots
}

export function handleWithdrawal(event: Withdrawal): void {
  // let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);

  pool.save();
}
