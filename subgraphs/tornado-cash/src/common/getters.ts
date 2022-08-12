import { Address, ethereum, log, BigInt } from "@graphprotocol/graph-ts";
import {
  Token,
  UsageMetricsDailySnapshot,
  FinancialsDailySnapshot,
  UsageMetricsHourlySnapshot,
  Protocol,
  Pool,
} from "../../generated/schema";
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
} from "./constants";

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
    // usageMetrics.dailyDepositCount = INT_ZERO;
    // usageMetrics.dailyWithdrawCount = INT_ZERO;
    // usageMetrics.dailySwapCount = INT_ZERO;

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
    // usageMetrics.hourlyDepositCount = INT_ZERO;
    // usageMetrics.hourlyWithdrawCount = INT_ZERO;
    // usageMetrics.hourlySwapCount = INT_ZERO;

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
    // financialMetrics.dailyVolumeUSD = BIGDECIMAL_ZERO;
    // financialMetrics.cumulativeVolumeUSD = BIGDECIMAL_ZERO;

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

import { TornadoCash_eth } from "../../generated/TornadoCash_eth/TornadoCash_eth";
import { TornadoCash_erc20 } from "../../generated/TornadoCash_eth/TornadoCash_erc20";
import { exponentToBigDecimal } from "./utils/numbers";
import { getUsdPricePerToken } from "../prices";

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(FACTORY_ADDRESS);

  if (!protocol) {
    protocol = new Protocol(FACTORY_ADDRESS);
    protocol.name = PROTOCOL_NAME;
    protocol.slug = PROTOCOL_SLUG;
    protocol.methodologyVersion = PROTOCOL_METHODOLOGY_VERSION;
    protocol.schemaVersion = PROTOCOL_SCHEMA_VERSION;
    protocol.subgraphVersion = PROTOCOL_SUBGRAPH_VERSION;
    protocol.network = Network.MAINNET;
    protocol.type = ProtocolType.GENERIC;
    protocol.totalValueLockedUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeUniqueUsers = 0;
    protocol.totalPoolCount = 0;

    protocol.save();
  }

  return protocol;
}

export function getOrCreateToken(
  tokenAddress: Address,
  blockNumber: BigInt
): Token {
  const tokenId = tokenAddress.toHexString();
  let token = Token.load(tokenId);

  if (!token) {
    token = new Token(tokenId);

    if (tokenAddress == Address.fromString(ETH_ADDRESS)) {
      token.name = ETH_NAME;
      token.symbol = ETH_SYMBOL;
      token.decimals = ETH_DECIMALS;
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

export function getOrCreatePool(
  poolAddress: string,
  event: ethereum.Event
): Pool {
  let pool = Pool.load(poolAddress);

  if (!pool) {
    pool = new Pool(poolAddress);

    pool.protocol = getOrCreateProtocol().id;

    let contractERC20 = TornadoCash_erc20.bind(Address.fromString(poolAddress));
    let token_call = contractERC20.try_token();
    if (!token_call.reverted) {
      let token = getOrCreateToken(token_call.value, event.block.number);
      pool.inputTokens = [token.id];
      pool.outputToken = token.id;

      let denomination_call = contractERC20.try_denomination();
      if (!denomination_call.reverted) {
        let denomination = denomination_call.value.divDecimal(
          exponentToBigDecimal(token.decimals)
        );

        pool.name = `TornadoCash ${denomination}${token.symbol}`;
        pool.symbol = `${denomination}${token.symbol}`;
      }
    } else {
      let token = getOrCreateToken(
        Address.fromString(ETH_ADDRESS),
        event.block.number
      );
      pool.inputTokens = [token.id];
      pool.outputToken = token.id;

      let contractETH = TornadoCash_eth.bind(Address.fromString(poolAddress));
      let denomination_call = contractETH.try_denomination();
      if (!denomination_call.reverted) {
        let denomination = denomination_call.value.divDecimal(
          exponentToBigDecimal(token.decimals)
        );

        pool.name = `TornadoCash ${denomination}${token.symbol}`;
        pool.symbol = `${denomination}${token.symbol}`;
      }
    }

    pool.createdTimestamp = event.block.timestamp;
    pool.createdBlockNumber = event.block.number;
    pool.totalValueLockedUSD = BIGDECIMAL_ZERO;
    pool.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
    pool.inputTokenBalances = [BIGINT_ZERO];

    pool.save();
  }

  return pool;
}
