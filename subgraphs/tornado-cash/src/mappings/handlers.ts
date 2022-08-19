import {
  createDeposit,
  createWithdrawal,
  createFeeUpdated,
  createRateChanged,
  createRewardSwap,
} from "./helpers";
import {
  updateFinancials,
  updatePoolMetrics,
  updateUsageMetrics,
} from "../common/metrics";

import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCashFeeManager/TornadoCashETH";
import { FeeUpdated } from "../../generated/TornadoCashFeeManager/TornadoCashFeeManager";
import { RateChanged } from "../../generated/TornadoCashMiner/TornadoCashMiner";
import { Swap } from "../../generated/TornadoCashRewardSwap/TornadoCashRewardSwap";

export function handleDeposit(event: Deposit): void {
  createDeposit(event);

  updatePoolMetrics(event);
  updateUsageMetrics(event);
  updateFinancials(event);
}

export function handleWithdrawal(event: Withdrawal): void {
  createWithdrawal(event);

  updatePoolMetrics(event);
  updateUsageMetrics(event);
  updateFinancials(event);
}

export function handleFeeUpdated(event: FeeUpdated): void {
  createFeeUpdated(event);

  updatePoolMetrics(event);
  updateFinancials(event);
}

export function handleRateChanged(event: RateChanged): void {
  createRateChanged(event);

  updatePoolMetrics(event);
}

export function handleRewardSwap(event: Swap): void {
  createRewardSwap(event);

  updatePoolMetrics(event);
}
