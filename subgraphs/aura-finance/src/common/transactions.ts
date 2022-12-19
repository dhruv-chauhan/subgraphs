import { BigInt, ethereum, BigDecimal } from "@graphprotocol/graph-ts";

import { NetworkConfigs } from "../../configurations/configure";

import {
  Vault as VaultStore,
  Deposit as DepositTransaction,
  Withdraw as WithdrawTransaction,
} from "../../generated/schema";

export function createDepositTransaction(
  vault: VaultStore,
  amount: BigInt,
  amountUSD: BigDecimal,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): DepositTransaction {
  const transactionId = "deposit"
    .concat("-")
    .concat(transaction.hash.toHexString());
  let depositTransaction = DepositTransaction.load(transactionId);

  if (!depositTransaction) {
    depositTransaction = new DepositTransaction(transactionId);

    depositTransaction.to = vault.id;
    depositTransaction.from = transaction.from.toHexString();
    depositTransaction.hash = transaction.hash.toHexString();
    depositTransaction.logIndex = transaction.index.toI32();

    depositTransaction.vault = vault.id;
    depositTransaction.protocol = NetworkConfigs.getFactoryAddress();
    depositTransaction.asset = vault.inputToken;
    depositTransaction.amount = amount;
    depositTransaction.amountUSD = amountUSD;

    depositTransaction.timestamp = block.timestamp;
    depositTransaction.blockNumber = block.number;

    depositTransaction.save();
  }

  return depositTransaction;
}

export function createWithdrawTransaction(
  vault: VaultStore,
  amount: BigInt,
  amountUSD: BigDecimal,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): WithdrawTransaction {
  const withdrawTransactionId = "withdraw"
    .concat("-")
    .concat(transaction.hash.toHexString());

  let withdrawTransaction = WithdrawTransaction.load(withdrawTransactionId);

  if (!withdrawTransaction) {
    withdrawTransaction = new WithdrawTransaction(withdrawTransactionId);

    withdrawTransaction.vault = vault.id;
    withdrawTransaction.protocol = NetworkConfigs.getFactoryAddress();

    withdrawTransaction.to = transaction.to!.toHexString();
    withdrawTransaction.from = transaction.from.toHexString();

    withdrawTransaction.hash = transaction.hash.toHexString();
    withdrawTransaction.logIndex = transaction.index.toI32();

    withdrawTransaction.asset = vault.inputToken;
    withdrawTransaction.amount = amount;
    withdrawTransaction.amountUSD = amountUSD;

    withdrawTransaction.timestamp = block.timestamp;
    withdrawTransaction.blockNumber = block.number;

    withdrawTransaction.save();
  }

  return withdrawTransaction;
}
