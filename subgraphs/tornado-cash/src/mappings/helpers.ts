import { Address, BigDecimal } from "@graphprotocol/graph-ts";

import {
  getOrCreateProtocol,
  getOrCreatePool,
  getOrCreateToken,
  getOrCreateRewardToken,
} from "../common/getters";
import {
  bigDecimalToBigInt,
  bigIntToBigDecimal,
} from "../common/utils/numbers";
import { getRewardsPerDay, RewardIntervalType } from "../common/rewards";
import { TORN_ADDRESS, vTORN_ADDRESS } from "../common/constants";

import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCashFeeManager/TornadoCashETH";
import { FeeUpdated } from "../../generated/TornadoCashFeeManager/TornadoCashFeeManager";
import { RateChanged } from "../../generated/TornadoCashMiner/TornadoCashMiner";
import { Swap } from "../../generated/TornadoCashRewardSwap/TornadoCashRewardSwap";

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
  pool.inputTokenBalances = [
    pool.inputTokenBalances[0].plus(pool._denomination),
  ];

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
  pool.cumulativeProtocolSideRevenueUSD = pool.cumulativeProtocolSideRevenueUSD.minus(
    bigIntToBigDecimal(pool._fee.times(pool._denomination))
  );
  // txn fee?
  pool.cumulativeSupplySideRevenueUSD = pool.cumulativeSupplySideRevenueUSD.plus(
    bigIntToBigDecimal(event.params.fee.minus(pool._fee))
  );
  pool.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD.plus(
    pool.cumulativeProtocolSideRevenueUSD.plus(
      pool.cumulativeSupplySideRevenueUSD
    )
  );
  pool.inputTokenBalances = [
    pool.inputTokenBalances[0].minus(pool._denomination),
  ];

  pool.save();
}

export function createFeeUpdated(event: FeeUpdated): void {
  let pool = getOrCreatePool(event.params.instance.toHexString(), event);

  pool._fee = event.params.newFee;

  pool.save();
}

export function createRateChanged(event: RateChanged): void {
  let pool = getOrCreatePool(event.params.instance.toHexString(), event);
  let vTORN = getOrCreateRewardToken(
    Address.fromString(vTORN_ADDRESS),
    event.block.number
  );

  let vTORNPerDay = getRewardsPerDay(
    event.block.timestamp,
    event.block.number,
    bigIntToBigDecimal(event.params.value),
    RewardIntervalType.BLOCK
  );

  pool.rewardTokenEmissionsAmount = [bigDecimalToBigInt(vTORNPerDay)];
  pool.rewardTokenEmissionsUSD = [
    vTORN._lastPriceUSD!.times(
      bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])
    ),
  ];

  pool.save();
}

function getvTORNprice(event: Swap): BigDecimal {
  let TORN = getOrCreateToken(
    Address.fromString(TORN_ADDRESS),
    event.block.number
  );
  let vTORN = getOrCreateRewardToken(
    Address.fromString(vTORN_ADDRESS),
    event.block.number
  );

  let vTORNLiquidity = event.params.pTORN.div(event.params.TORN);

  vTORN._lastPriceUSD = TORN.lastPriceUSD!.div(
    bigIntToBigDecimal(vTORNLiquidity)
  );

  vTORN.save();

  return vTORN._lastPriceUSD!;
}

export function createRewardSwap(event: Swap): void {
  let vTORNPrice = getvTORNprice(event);

  let protocol = getOrCreateProtocol();
  let pools = protocol.pools;
  for (let i = 0; i < pools.length; i++) {
    let pool = getOrCreatePool(pools[i], event);

    pool.rewardTokenEmissionsUSD = [
      vTORNPrice.times(bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])),
    ];

    pool.save();
  }
}
