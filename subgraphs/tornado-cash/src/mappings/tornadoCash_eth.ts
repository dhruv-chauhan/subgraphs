import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCash_eth/TornadoCash_eth";
import { PoolDeposit, PoolWithdrawal } from "../../generated/schema";

function randomHex(): string {
  return (Math.random() + 1).toString(36).substring(7);
}

export function handleDeposit(event: Deposit): void {
  // let pool = PoolDeposit.load(event.transaction.hash.toHex());
  // if(pool == null)
  //   pool = new PoolDeposit(event.transaction.hash.toHex());

  // pool.block = event.block.number;

  let pool = new PoolDeposit(randomHex());

  pool.commitment = event.params.commitment.toString();
  pool.leafIndex = event.params.leafIndex;
  pool.timestamp = event.params.timestamp;

  pool.save();
}

export function handleWithdrawal(event: Withdrawal): void {
  // let pool = PoolWithdrawal.load(event.transaction.hash.toHex());
  // if(pool == null)
  //   pool = new PoolWithdrawal(event.transaction.hash.toHex());

  // pool.block = event.block.number;

  let pool = new PoolWithdrawal(randomHex());

  pool.to = event.params.to.toHex();
  pool.nullifierHash = event.params.nullifierHash;
  pool.relayer = event.params.relayer.toHex();
  pool.fee = event.params.fee;

  pool.save();
}
