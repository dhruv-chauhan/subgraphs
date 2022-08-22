import { Address, BigDecimal, log } from "@graphprotocol/graph-ts";

import {
  getOrCreateProtocol,
  getOrCreatePool,
  getOrCreateToken,
  getOrCreateRewardToken,
  getOrCreatePoolDailySnapshot,
  getOrCreatePoolHourlySnapshot,
  getOrCreateFinancialsDailySnapshot,
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
  let protocol = getOrCreateProtocol();
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

  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(
    bigIntToBigDecimal(pool._denomination).times(inputToken.lastPriceUSD!)
  );

  protocol.save();
}

export function createWithdrawal(event: Withdrawal): void {
  let protocol = getOrCreateProtocol();
  let pool = getOrCreatePool(event.address.toHexString(), event);
  let inputToken = getOrCreateToken(
    Address.fromString(pool.inputTokens[0]),
    event.block.number
  );
  let poolMetricsDaily = getOrCreatePoolDailySnapshot(event);
  let poolMetricsHourly = getOrCreatePoolHourlySnapshot(event);
  let financialMetricsDaily = getOrCreateFinancialsDailySnapshot(event);

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

  poolMetricsDaily.dailyTotalRevenueUSD =
    poolMetricsDaily.dailyTotalRevenueUSD.plus(
      bigIntToBigDecimal(event.params.fee)
    );
  poolMetricsDaily.dailyProtocolSideRevenueUSD =
    poolMetricsDaily.dailyProtocolSideRevenueUSD.plus(
      bigIntToBigDecimal(pool._fee.times(pool._denomination))
    );
  poolMetricsDaily.dailySupplySideRevenueUSD =
    poolMetricsDaily.dailyTotalRevenueUSD.minus(
      poolMetricsDaily.dailyProtocolSideRevenueUSD
    );
  poolMetricsDaily.save();

  poolMetricsHourly.hourlyTotalRevenueUSD =
    poolMetricsHourly.hourlyTotalRevenueUSD.plus(
      bigIntToBigDecimal(event.params.fee)
    );
  poolMetricsHourly.hourlyProtocolSideRevenueUSD =
    poolMetricsHourly.hourlyProtocolSideRevenueUSD.plus(
      bigIntToBigDecimal(pool._fee.times(pool._denomination))
    );
  poolMetricsHourly.hourlySupplySideRevenueUSD =
    poolMetricsHourly.hourlyTotalRevenueUSD.minus(
      poolMetricsDaily.dailyProtocolSideRevenueUSD
    );
  poolMetricsHourly.save();

  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.minus(
    bigIntToBigDecimal(pool._denomination).times(inputToken.lastPriceUSD!)
  );
  protocol.cumulativeTotalRevenueUSD = protocol.cumulativeTotalRevenueUSD.plus(
    bigIntToBigDecimal(event.params.fee)
  );
  protocol.cumulativeProtocolSideRevenueUSD =
    protocol.cumulativeProtocolSideRevenueUSD.plus(
      bigIntToBigDecimal(pool._fee.times(pool._denomination))
    );
  protocol.cumulativeSupplySideRevenueUSD =
    protocol.cumulativeSupplySideRevenueUSD.plus(
      pool.cumulativeTotalRevenueUSD.minus(
        pool.cumulativeProtocolSideRevenueUSD
      )
    );
  protocol.save();

  financialMetricsDaily.dailyTotalRevenueUSD =
    financialMetricsDaily.dailyTotalRevenueUSD.plus(
      bigIntToBigDecimal(pool._denomination).times(inputToken.lastPriceUSD!)
    );
  financialMetricsDaily.dailyProtocolSideRevenueUSD =
    financialMetricsDaily.dailyProtocolSideRevenueUSD.plus(
      bigIntToBigDecimal(event.params.fee)
    );
  financialMetricsDaily.dailySupplySideRevenueUSD =
    financialMetricsDaily.dailyTotalRevenueUSD.minus(
      financialMetricsDaily.dailyProtocolSideRevenueUSD
    );
  financialMetricsDaily.save();
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

  let rewardsPerDay = getRewardsPerDay(
    event.block.timestamp,
    event.block.number,
    bigIntToBigDecimal(event.params.value),
    RewardIntervalType.BLOCK
  );

  pool.rewardTokenEmissionsAmount = [bigDecimalToBigInt(rewardsPerDay)];
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

    pool.rewardTokenEmissionsUSD = [
      getUsdPrice(
        Address.fromString(rewardToken.id.split("-")[1]),
        bigIntToBigDecimal(pool.rewardTokenEmissionsAmount![0])
      ),
    ];

    pool.save();
  }
}
