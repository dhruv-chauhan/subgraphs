import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";

import {
  getOrCreateToken,
  getOrCreateVault,
  getOrCreateYieldAggregator,
  getOrCreateRewardPool,
  getOrCreateFeeType,
  getFees,
  getOrCreateBalancerPoolToken,
} from "../common/getters";
import {
  BIGDECIMAL_ONE,
  BIGINT_ONE,
  BIGINT_ZERO,
  VaultFeeType,
  BAL_TOKEN_ADDR,
  BIGDECIMAL_1E18,
  BIGDECIMAL_ZERO,
} from "../common/constants";
import { bigIntToBigDecimal } from "../common/utils/numbers";
import { readValue } from "../common/utils/ethereum";
import { prefixID } from "../common/utils/strings";
import { addToArrayAtIndex } from "../common/utils/arrays";
import {
  updateUsageMetricsAfterDeposit,
  updateUsageMetricsAfterWithdraw,
  updateProtocolTotalValueLockedUSD,
  updateRevenue,
  updateRewards,
} from "../common/metrics";
import {
  createDepositTransaction,
  createWithdrawTransaction,
} from "../common/transactions";
import { CustomFeesType } from "../common/types";

import { ERC20 } from "../../generated/Booster-v1/ERC20";
import { BaseRewardPool } from "../../generated/Booster-v1/BaseRewardPool";

export function createPoolAdd(
  boosterAddr: Address,
  poolId: BigInt,
  block: ethereum.Block
): void {
  const protocol = getOrCreateYieldAggregator();

  const vault = getOrCreateVault(boosterAddr, poolId, block);
  if (!vault) return;

  protocol.totalPoolCount += 1;
  protocol._vaultIds = addToArrayAtIndex<string>(protocol._vaultIds, vault.id);
  protocol._activePoolCount = protocol._activePoolCount.plus(BIGINT_ONE);

  protocol.save();
}

export function createPoolShutdown(
  boosterAddr: Address,
  poolId: BigInt,
  block: ethereum.Block
): void {
  const protocol = getOrCreateYieldAggregator();

  const vault = getOrCreateVault(boosterAddr, poolId, block);
  if (!vault) return;

  vault._active = false;
  vault.save();

  protocol._activePoolCount = protocol._activePoolCount.minus(BIGINT_ONE);

  protocol.save();
}

export function createDeposit(
  boosterAddr: Address,
  poolId: BigInt,
  amount: BigInt,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): void {
  const vault = getOrCreateVault(boosterAddr, poolId, block);
  if (!vault) return;

  const inputToken = getOrCreateBalancerPoolToken(
    Address.fromString(vault.inputToken),
    block.number
  );

  const depositAmount = amount;
  const depositAmountUSD = bigIntToBigDecimal(
    depositAmount,
    inputToken.decimals
  ).times(inputToken.lastPriceUSD!);

  vault.inputTokenBalance = vault.inputTokenBalance.plus(depositAmount);
  vault.totalValueLockedUSD = bigIntToBigDecimal(
    vault.inputTokenBalance,
    inputToken.decimals
  ).times(inputToken.lastPriceUSD!);

  const outputToken = getOrCreateToken(
    Address.fromString(vault.outputToken!),
    block.number
  );
  const outputTokenContract = ERC20.bind(
    Address.fromString(vault.outputToken!)
  );

  vault.outputTokenSupply = readValue<BigInt>(
    outputTokenContract.try_totalSupply(),
    BIGINT_ZERO
  );
  vault.outputTokenPriceUSD =
    vault.outputTokenSupply != BIGINT_ZERO
      ? vault.totalValueLockedUSD.div(
          bigIntToBigDecimal(vault.outputTokenSupply!, outputToken.decimals)
        )
      : BIGDECIMAL_ZERO;

  const rewardPoolContract = BaseRewardPool.bind(
    Address.fromString(vault._balRewards)
  );

  vault.pricePerShare = readValue<BigInt>(
    rewardPoolContract.try_convertToAssets(BIGINT_ONE),
    BIGINT_ZERO
  )
    .toBigDecimal()
    .times(BIGDECIMAL_1E18);

  vault.save();

  createDepositTransaction(
    vault,
    depositAmount,
    depositAmountUSD,
    transaction,
    block
  );

  updateProtocolTotalValueLockedUSD();
  updateUsageMetricsAfterDeposit(block);
}

export function createWithdraw(
  boosterAddr: Address,
  poolId: BigInt,
  amount: BigInt,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): void {
  const vault = getOrCreateVault(boosterAddr, poolId, block);
  if (!vault) return;

  const inputToken = getOrCreateBalancerPoolToken(
    Address.fromString(vault.inputToken),
    block.number
  );

  const withdrawAmount = amount;
  const withdrawAmountUSD = bigIntToBigDecimal(
    withdrawAmount,
    inputToken.decimals
  ).times(inputToken.lastPriceUSD!);

  vault.inputTokenBalance = vault.inputTokenBalance.minus(withdrawAmount);
  vault.totalValueLockedUSD = bigIntToBigDecimal(
    vault.inputTokenBalance,
    inputToken.decimals
  ).times(inputToken.lastPriceUSD!);

  const outputToken = getOrCreateToken(
    Address.fromString(vault.outputToken!),
    block.number
  );
  const outputTokenContract = ERC20.bind(
    Address.fromString(vault.outputToken!)
  );

  vault.outputTokenSupply = readValue<BigInt>(
    outputTokenContract.try_totalSupply(),
    BIGINT_ZERO
  );
  vault.outputTokenPriceUSD =
    vault.outputTokenSupply != BIGINT_ZERO
      ? vault.totalValueLockedUSD.div(
          bigIntToBigDecimal(vault.outputTokenSupply!, outputToken.decimals)
        )
      : BIGDECIMAL_ZERO;

  const rewardPoolContract = BaseRewardPool.bind(
    Address.fromString(vault._balRewards)
  );

  vault.pricePerShare = readValue<BigInt>(
    rewardPoolContract.try_convertToAssets(BIGINT_ONE),
    BIGINT_ZERO
  )
    .toBigDecimal()
    .times(BIGDECIMAL_1E18);

  vault.save();

  createWithdrawTransaction(
    vault,
    withdrawAmount,
    withdrawAmountUSD,
    transaction,
    block
  );

  updateProtocolTotalValueLockedUSD();
  updateUsageMetricsAfterWithdraw(block);
}

export function createFeesUpdate(
  boosterAddr: Address,
  lockIncentive: BigInt,
  earmarkIncentive: BigInt,
  stakerIncentive: BigInt,
  platformFee: BigInt
): void {
  const newFees = new CustomFeesType(
    lockIncentive,
    earmarkIncentive,
    stakerIncentive,
    platformFee
  );

  const performanceFeeId = prefixID(
    VaultFeeType.PERFORMANCE_FEE,
    boosterAddr.toHexString()
  );

  getOrCreateFeeType(
    performanceFeeId,
    VaultFeeType.PERFORMANCE_FEE,
    newFees.totalFees()
  );
}

export function createRewardAdd(
  boosterAddr: Address,
  poolId: BigInt,
  rewardPoolAddr: Address,
  block: ethereum.Block
): void {
  const rewardPool = getOrCreateRewardPool(poolId, rewardPoolAddr, block);
  const rewardsEarned = rewardPool.lastAddedRewards;

  const fees = getFees(boosterAddr);
  const totalFees = fees.totalFees();

  const totalRewardsEarned = rewardsEarned
    .toBigDecimal()
    .div(BIGDECIMAL_ONE.minus(totalFees));

  const balToken = getOrCreateToken(BAL_TOKEN_ADDR, block.number);

  const totalRevenueUSD = totalRewardsEarned.times(balToken.lastPriceUSD!).div(
    BigInt.fromI32(10)
      .pow(balToken.decimals as u8)
      .toBigDecimal()
  );

  updateRevenue(boosterAddr, poolId, totalRevenueUSD, totalFees, block);
  updateRewards(boosterAddr, poolId, rewardPoolAddr, block);
}
