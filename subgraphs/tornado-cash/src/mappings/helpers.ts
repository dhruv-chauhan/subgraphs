import { Address, BigDecimal, log } from "@graphprotocol/graph-ts";

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
import { TORN_ADDRESS } from "../common/constants";
import { getUsdPrice } from "../prices";

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

  pool.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD.plus(
    bigIntToBigDecimal(event.params.fee)
  );
  pool.cumulativeProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD.plus(
      bigIntToBigDecimal(pool._fee.times(pool._denomination))
    );
  pool.cumulativeSupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD.plus(
      pool.cumulativeTotalRevenueUSD.minus(
        pool.cumulativeProtocolSideRevenueUSD
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
  let rewardToken = getOrCreateRewardToken(
    Address.fromString(TORN_ADDRESS),
    event.block.number
  );
  log.info("RateChanged {} {}", [
    event.params.instance.toHexString(),
    event.params.value.toString(),
  ]);
  let rewardsPerDay = getRewardsPerDay(
    event.block.timestamp,
    event.block.number,
    bigIntToBigDecimal(event.params.value),
    RewardIntervalType.BLOCK
  );
  log.info("getRewardsPerDay {}", [rewardsPerDay.toString()]);

  pool.rewardTokenEmissionsAmount = [bigDecimalToBigInt(rewardsPerDay)];
  // pool.rewardTokenEmissionsUSD = [
  //   TORN._lastPriceUSD!.times(
  //     bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])
  //   ),
  // ];

  pool.rewardTokenEmissionsUSD = [
    getUsdPrice(
      Address.fromString(rewardToken.id.split("-")[1]),
      rewardsPerDay
    ),
  ];

  pool.save();
}

export function createRewardSwap(event: Swap): void {
  let rewardToken = getOrCreateRewardToken(
    Address.fromString(TORN_ADDRESS),
    event.block.number
  );

  let protocol = getOrCreateProtocol();
  let pools = protocol.pools;
  for (let i = 0; i < pools.length; i++) {
    let pool = getOrCreatePool(pools[i], event);

    // pool.rewardTokenEmissionsUSD = [
    //   rewardToken._lastPriceUSD!.times(
    //     bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])
    //   ),
    // ];

    pool.rewardTokenEmissionsUSD = [
      getUsdPrice(
        Address.fromString(rewardToken.id.split("-")[1]),
        bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])
      ),
    ];

    pool.save();
  }
}
