import {
  Deposit,
  Withdrawal,
} from "../../generated/TornadoCash_eth/TornadoCash_eth";
import {
  updateFinancials,
  updatePoolMetrics,
  updateUsageMetrics,
} from "../common/metrics";
import { createDeposit, createWithdrawal } from "./helpers";

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
