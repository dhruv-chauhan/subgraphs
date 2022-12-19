import { dataSource, BigInt, Address } from "@graphprotocol/graph-ts";

import {
  createPoolAdd,
  createPoolShutdown,
  createDeposit,
  createWithdraw,
  createFeesUpdate,
  createRewardAdd,
} from "./helpers";
import {
  updateUsageMetrics,
  updateFinancials,
  updateVaultSnapshots,
  updateRewards,
} from "../common/metrics";
import { ZERO_ADDRESS } from "../common/constants";

import {
  PoolAdded,
  Deposited,
  Withdrawn,
  FeesUpdated,
  PoolShutdown,
} from "../../generated/Booster-v1/Booster";
import {
  BaseRewardPool,
  RewardAdded,
  RewardPaid,
} from "../../generated/Booster-v1/BaseRewardPool";

export function handlePoolAdded(event: PoolAdded): void {
  const boosterAddr = dataSource.address();
  const poolId = event.params.pid;

  createPoolAdd(boosterAddr, poolId, event.block);
}

export function handlePoolShutdown(event: PoolShutdown): void {
  const boosterAddr = dataSource.address();
  const poolId = event.params.poolId;

  createPoolShutdown(boosterAddr, poolId, event.block);
}

export function handleDeposited(event: Deposited): void {
  const boosterAddr = dataSource.address();
  const poolId = event.params.poolid;
  const amount = event.params.amount;

  createDeposit(boosterAddr, poolId, amount, event.transaction, event.block);

  updateUsageMetrics(event.transaction, event.block);
  updateFinancials(event.block);
  updateVaultSnapshots(boosterAddr, poolId, event.block);
}

export function handleWithdrawn(event: Withdrawn): void {
  const boosterAddr = dataSource.address();
  const poolId = event.params.poolid;
  const amount = event.params.amount;

  createWithdraw(boosterAddr, poolId, amount, event.transaction, event.block);

  updateFinancials(event.block);
  updateUsageMetrics(event.transaction, event.block);
  updateVaultSnapshots(boosterAddr, poolId, event.block);
}

export function handleFeesUpdated(event: FeesUpdated): void {
  const boosterAddr = dataSource.address();
  const lockIncentive = event.params.lockIncentive;
  const earmarkIncentive = event.params.earmarkIncentive;
  const stakerIncentive = event.params.stakerIncentive;
  const platformFee = event.params.platformFee;

  createFeesUpdate(
    boosterAddr,
    lockIncentive,
    earmarkIncentive,
    stakerIncentive,
    platformFee
  );
}

export function handleRewardAdded(event: RewardAdded): void {
  const context = dataSource.context();
  const poolId = BigInt.fromString(context.getString("poolId"));
  const rewardPoolAddr = event.address;

  const rewardPoolContract = BaseRewardPool.bind(rewardPoolAddr);
  const operatorCall = rewardPoolContract.try_operator();

  let boosterAddr = Address.fromString(ZERO_ADDRESS);
  if (!operatorCall.reverted) {
    boosterAddr = operatorCall.value;
  }

  createRewardAdd(boosterAddr, poolId, rewardPoolAddr, event.block);

  updateFinancials(event.block);
  updateVaultSnapshots(boosterAddr, poolId, event.block);
}

export function handleRewardPaid(event: RewardPaid): void {
  const context = dataSource.context();
  const poolId = BigInt.fromString(context.getString("poolId"));

  const rewardPoolAddr = event.address;

  const rewardPoolContract = BaseRewardPool.bind(rewardPoolAddr);
  const operatorCall = rewardPoolContract.try_operator();

  let boosterAddr = Address.fromString(ZERO_ADDRESS);
  if (!operatorCall.reverted) {
    boosterAddr = operatorCall.value;
  }

  updateRewards(boosterAddr, poolId, rewardPoolAddr, event.block);

  updateUsageMetrics(event.transaction, event.block);
  updateVaultSnapshots(boosterAddr, poolId, event.block);
}
