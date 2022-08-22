import { Address, ethereum, BigInt } from "@graphprotocol/graph-ts";

import { fetchTokenSymbol, fetchTokenName, fetchTokenDecimals } from "./tokens";
import {
  BIGDECIMAL_ZERO,
  Network,
  INT_ZERO,
  FACTORY_ADDRESS,
  ProtocolType,
  SECONDS_PER_DAY,
  BIGINT_ZERO,
  SECONDS_PER_HOUR,
  RewardTokenType,
  PROTOCOL_NAME,
  PROTOCOL_SLUG,
  PROTOCOL_SCHEMA_VERSION,
  PROTOCOL_SUBGRAPH_VERSION,
  PROTOCOL_METHODOLOGY_VERSION,
  ETH_ADDRESS,
  ETH_NAME,
  ETH_SYMBOL,
  ETH_DECIMALS,
  TORN_ADDRESS,
  TORN_NAME,
  TORN_SYMBOL,
  TORN_DECIMALS,
} from "./constants";
import { getUsdPricePerToken } from "../prices";
import { addToArrayAtIndex } from "../common/utils/arrays";

import { TornadoCashETH } from "../../generated/TornadoCashFeeManager/TornadoCashETH";
import { TornadoCashERC20 } from "../../generated/TornadoCashFeeManager/TornadoCashERC20";
import {
  Protocol,
  Pool,
  PoolDailySnapshot,
  PoolHourlySnapshot,
  Token,
  RewardToken,
  UsageMetricsHourlySnapshot,
  UsageMetricsDailySnapshot,
  FinancialsDailySnapshot,
} from "../../generated/schema";

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(FACTORY_ADDRESS);

  if (!protocol) {
    protocol = new Protocol(FACTORY_ADDRESS);
    protocol.name = PROTOCOL_NAME;
    protocol.slug = PROTOCOL_SLUG;
    protocol.schemaVersion = PROTOCOL_SCHEMA_VERSION;
    protocol.subgraphVersion = PROTOCOL_SUBGRAPH_VERSION;
    protocol.methodologyVersion = PROTOCOL_METHODOLOGY_VERSION;
    protocol.network = Network.MAINNET;
    protocol.type = ProtocolType.GENERIC;
    protocol.totalValueLockedUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeUniqueUsers = 0;
    protocol.totalPoolCount = 0;
    protocol.pools = [];

    protocol.save();
  }

  return protocol;
}

export function getOrCreateToken(
  tokenAddress: Address,
  blockNumber: BigInt
): Token {
  let token = Token.load(tokenAddress.toHexString());

  if (!token) {
    token = new Token(tokenAddress.toHexString());

    if (tokenAddress == Address.fromString(ETH_ADDRESS)) {
      token.name = ETH_NAME;
      token.symbol = ETH_SYMBOL;
      token.decimals = ETH_DECIMALS;
    } else if (tokenAddress == Address.fromString(TORN_ADDRESS)) {
      token.name = TORN_NAME;
      token.symbol = TORN_SYMBOL;
      token.decimals = TORN_DECIMALS;
    } else {
      token.name = fetchTokenName(tokenAddress);
      token.symbol = fetchTokenSymbol(tokenAddress);
      token.decimals = fetchTokenDecimals(tokenAddress) as i32;
    }
  }

  const price = getUsdPricePerToken(tokenAddress);
  if (price.reverted) {
    token.lastPriceUSD = BIGDECIMAL_ZERO;
  } else {
    token.lastPriceUSD = price.usdPrice.div(price.decimalsBaseTen);
  }
  token.lastPriceBlockNumber = blockNumber;
  token.save();

  return token;
}

export function getOrCreateRewardToken(
  address: Address,
  blockNumber: BigInt
): RewardToken {
  let rewardToken = RewardToken.load(
    RewardTokenType.DEPOSIT.concat("-").concat(address.toHexString())
  );

  if (!rewardToken) {
    let token = getOrCreateToken(address, blockNumber);

    rewardToken = new RewardToken(
      RewardTokenType.DEPOSIT.concat("-").concat(address.toHexString())
    );

    rewardToken.token = token.id;
    rewardToken.type = RewardTokenType.DEPOSIT;

    rewardToken.save();
  }

  return rewardToken;
}

export function getOrCreatePool(
  poolAddress: string,
  event: ethereum.Event
): Pool {
  let pool = Pool.load(poolAddress);

  if (!pool) {
    let protocol = getOrCreateProtocol();
    let usageMetricsDaily = getOrCreateUsageMetricDailySnapshot(event);

    pool = new Pool(poolAddress);

    let contractERC20 = TornadoCashERC20.bind(Address.fromString(poolAddress));
    let token_call = contractERC20.try_token();
    if (!token_call.reverted) {
      let token = getOrCreateToken(token_call.value, event.block.number);
      pool.inputTokens = [token.id];

      let denomination_call = contractERC20.try_denomination();
      if (!denomination_call.reverted) {
        let denomination = denomination_call.value.div(
          BigInt.fromI32(10).pow(token.decimals as u8)
        );

        pool._denomination = denomination;
        pool.name = `TornadoCash ${denomination}${token.symbol}`;
        pool.symbol = `${denomination}${token.symbol}`;
      }
    } else {
      let token = getOrCreateToken(
        Address.fromString(ETH_ADDRESS),
        event.block.number
      );
      pool.inputTokens = [token.id];

      let contractETH = TornadoCashETH.bind(Address.fromString(poolAddress));
      let denomination_call = contractETH.try_denomination();
      if (!denomination_call.reverted) {
        let denomination = denomination_call.value.div(
          BigInt.fromI32(10).pow(token.decimals as u8)
        );

        pool._denomination = denomination;
        pool.name = `TornadoCash ${denomination}${token.symbol}`;
        pool.symbol = `${denomination}${token.symbol}`;
      }
    }

    pool.rewardTokens = [
      getOrCreateRewardToken(
        Address.fromString(TORN_ADDRESS),
        event.block.number
      ).id,
    ];
    pool.rewardTokenEmissionsAmount = [BIGINT_ZERO];
    pool.rewardTokenEmissionsUSD = [BIGDECIMAL_ZERO];

    pool.protocol = protocol.id;
    pool._fee = BIGINT_ZERO;
    pool.totalValueLockedUSD = BIGDECIMAL_ZERO;
    pool.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    pool.inputTokenBalances = [BIGINT_ZERO];

    pool.createdTimestamp = event.block.timestamp;
    pool.createdBlockNumber = event.block.number;

    pool.save();

    protocol.pools = addToArrayAtIndex<string>(protocol.pools, pool.id);
    protocol.totalPoolCount = protocol.totalPoolCount + 1;
    protocol.save();

    usageMetricsDaily.totalPoolCount = usageMetricsDaily.totalPoolCount + 1;
    usageMetricsDaily.save();
  }

  return pool;
}

export function getOrCreatePoolDailySnapshot(
  event: ethereum.Event
): PoolDailySnapshot {
  let day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  let dayId = day.toString();
  let poolMetrics = PoolDailySnapshot.load(
    event.address.toHexString().concat("-").concat(dayId)
  );

  if (!poolMetrics) {
    poolMetrics = new PoolDailySnapshot(
      event.address.toHexString().concat("-").concat(dayId)
    );
    poolMetrics.protocol = FACTORY_ADDRESS;
    poolMetrics.pool = event.address.toHexString();
    poolMetrics.totalValueLockedUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.dailySupplySideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.dailyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.dailyTotalRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.inputTokenBalances = [BIGINT_ZERO];
    poolMetrics.rewardTokenEmissionsAmount = [BIGINT_ZERO];
    poolMetrics.rewardTokenEmissionsUSD = [BIGDECIMAL_ZERO];

    poolMetrics.blockNumber = event.block.number;
    poolMetrics.timestamp = event.block.timestamp;

    poolMetrics.save();
  }

  return poolMetrics;
}

export function getOrCreatePoolHourlySnapshot(
  event: ethereum.Event
): PoolHourlySnapshot {
  let day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  let dayId = day.toString();
  let poolMetrics = PoolHourlySnapshot.load(
    event.address.toHexString().concat("-").concat(dayId)
  );

  if (!poolMetrics) {
    poolMetrics = new PoolHourlySnapshot(
      event.address.toHexString().concat("-").concat(dayId)
    );
    poolMetrics.protocol = FACTORY_ADDRESS;
    poolMetrics.pool = event.address.toHexString();
    poolMetrics.totalValueLockedUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.hourlySupplySideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.hourlyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.hourlyTotalRevenueUSD = BIGDECIMAL_ZERO;
    poolMetrics.inputTokenBalances = [BIGINT_ZERO];
    poolMetrics.rewardTokenEmissionsAmount = [BIGINT_ZERO];
    poolMetrics.rewardTokenEmissionsUSD = [BIGDECIMAL_ZERO];

    poolMetrics.blockNumber = event.block.number;
    poolMetrics.timestamp = event.block.timestamp;

    poolMetrics.save();
  }

  return poolMetrics;
}

export function getOrCreateUsageMetricDailySnapshot(
  event: ethereum.Event
): UsageMetricsDailySnapshot {
  // Number of days since Unix epoch
  let id = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  let dayId = id.toString();
  // Create unique id for the day
  let usageMetrics = UsageMetricsDailySnapshot.load(dayId);

  if (!usageMetrics) {
    usageMetrics = new UsageMetricsDailySnapshot(dayId);
    usageMetrics.protocol = FACTORY_ADDRESS;
    usageMetrics.dailyActiveUsers = INT_ZERO;
    usageMetrics.cumulativeUniqueUsers = INT_ZERO;
    usageMetrics.dailyTransactionCount = INT_ZERO;
    usageMetrics.totalPoolCount = INT_ZERO;
    usageMetrics.blockNumber = event.block.number;
    usageMetrics.timestamp = event.block.timestamp;

    usageMetrics.save();
  }

  return usageMetrics;
}

export function getOrCreateUsageMetricHourlySnapshot(
  event: ethereum.Event
): UsageMetricsHourlySnapshot {
  // Number of days since Unix epoch
  let hour = event.block.timestamp.toI32() / SECONDS_PER_HOUR;
  let hourId = hour.toString();

  // Create unique id for the day
  let usageMetrics = UsageMetricsHourlySnapshot.load(hourId);

  if (!usageMetrics) {
    usageMetrics = new UsageMetricsHourlySnapshot(hourId);
    usageMetrics.protocol = FACTORY_ADDRESS;
    usageMetrics.hourlyActiveUsers = INT_ZERO;
    usageMetrics.cumulativeUniqueUsers = INT_ZERO;
    usageMetrics.hourlyTransactionCount = INT_ZERO;
    usageMetrics.blockNumber = event.block.number;
    usageMetrics.timestamp = event.block.timestamp;

    usageMetrics.save();
  }

  return usageMetrics;
}

export function getOrCreateFinancialsDailySnapshot(
  event: ethereum.Event
): FinancialsDailySnapshot {
  // Number of days since Unix epoch
  let dayID = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  let id = dayID.toString();

  let financialMetrics = FinancialsDailySnapshot.load(id);

  if (!financialMetrics) {
    financialMetrics = new FinancialsDailySnapshot(id);
    financialMetrics.protocol = FACTORY_ADDRESS;
    financialMetrics.totalValueLockedUSD = BIGDECIMAL_ZERO;
    financialMetrics.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.dailySupplySideRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.dailyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.dailyTotalRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    financialMetrics.blockNumber = event.block.number;
    financialMetrics.timestamp = event.block.timestamp;

    financialMetrics.save();
  }

  return financialMetrics;
}
