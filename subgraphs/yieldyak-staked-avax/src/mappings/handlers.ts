import {
  Address,
  BigDecimal,
  BigInt,
  dataSource,
} from "@graphprotocol/graph-ts";

import { Versions } from "../versions";
import { NetworkConfigs } from "../../configurations/configure";
import { getUsdPricePerToken } from "../prices";

import { SDK } from "../sdk/protocols/generic";
import { ProtocolConfig, TokenPricer } from "../sdk/protocols/config";
import { TokenInitializer, TokenParams } from "../sdk/protocols/generic/tokens";
import { bigIntToBigDecimal } from "../sdk/util/numbers";
import {
  BIGDECIMAL_ZERO,
  ETH_ADDRESS,
  INT_ZERO,
  Network,
} from "../sdk/util/constants";

import {
  TransferSingle,
  TransferBatch,
  GAVAX,
} from "../../generated/GAVAX/GAVAX";
import { _ERC20 } from "../../generated/GAVAX/_ERC20";
import { ChainlinkDataFeed } from "../../generated/GAVAX/ChainlinkDataFeed";
import { Token } from "../../generated/schema";
import { CustomPriceType } from "../prices/common/types";

const conf = new ProtocolConfig(
  NetworkConfigs.getProtocolId(),
  NetworkConfigs.getProtocolName(),
  NetworkConfigs.getProtocolSlug(),
  Versions
);

class Pricer implements TokenPricer {
  getTokenPrice(token: Token): BigDecimal {
    let pricedTokenAddr = Address.fromBytes(token.id);
    let returnedPrice = BIGDECIMAL_ZERO;

    const network = dataSource.network().toUpperCase().replace("-", "_");
    if (network == Network.AVALANCHE) {
      if (pricedTokenAddr == NetworkConfigs.getLSTAddress()) {
        const gAVAX = GAVAX.bind(NetworkConfigs.getLSTAddress());
        const multiplierCall = gAVAX.pricePerShare(
          BigInt.fromString(NetworkConfigs.getProtocolIdBI())
        );
        const multiplier = bigIntToBigDecimal(multiplierCall);
        pricedTokenAddr = NetworkConfigs.getWAVAXAddress();

        const chainlinkDataFeedContract = ChainlinkDataFeed.bind(
          Address.fromString("0x0a77230d17318075983913bc2145db16c7366156") // AVAX / USD feed
        );

        const result = chainlinkDataFeedContract.latestAnswer();
        const decimals = chainlinkDataFeedContract.decimals();
        const usdPricePerToken = CustomPriceType.initialize(
          result.toBigDecimal(),
          decimals as i32,
          "ChainlinkFeed"
        );
        returnedPrice = usdPricePerToken.usdPrice.times(multiplier);
      } else {
        returnedPrice = getUsdPricePerToken(pricedTokenAddr).usdPrice;
      }
    }
    return returnedPrice;
  }

  getAmountValueUSD(token: Token, amount: BigInt): BigDecimal {
    const _amount = bigIntToBigDecimal(amount, token.decimals);
    return this.getTokenPrice(token).times(_amount);
  }
}

class TokenInit implements TokenInitializer {
  getTokenParams(address: Address): TokenParams {
    let name = "unknown";
    let symbol = "UNKNOWN";
    let decimals = INT_ZERO as i32;

    if (address == Address.fromString(ETH_ADDRESS)) {
      name = "eth";
      symbol = "ETH";
      decimals = 18 as i32;
    } else if (address == NetworkConfigs.getLSTAddress()) {
      name = "Geode Staked AVAX";
      symbol = "gAVAX";
      decimals = 18 as i32;
    } else {
      const erc20 = _ERC20.bind(address);
      name = erc20.name();
      symbol = erc20.symbol();
      decimals = erc20.decimals().toI32();
    }
    return new TokenParams(name, symbol, decimals);
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  const sdk = SDK.initializeFromEvent(
    conf,
    new Pricer(),
    new TokenInit(),
    event
  );
  const token = sdk.Tokens.getOrCreateToken(NetworkConfigs.getLSTAddress());
  const pool = sdk.Pools.loadPool(token.id);
  if (!pool.isInitialized) {
    pool.initialize("Stakers Pool", "gAVAX", [token.id], null);
  }

  const gAVAX = GAVAX.bind(NetworkConfigs.getLSTAddress());
  const supply = gAVAX.totalSupply(
    BigInt.fromString(NetworkConfigs.getProtocolIdBI())
  );
  pool.setInputTokenBalances([supply], true);

  const user = event.transaction.from;
  const account = sdk.Accounts.loadAccount(user);
  account.trackActivity();
}

export function handleTransferBatch(event: TransferBatch): void {
  const sdk = SDK.initializeFromEvent(
    conf,
    new Pricer(),
    new TokenInit(),
    event
  );
  const token = sdk.Tokens.getOrCreateToken(NetworkConfigs.getLSTAddress());
  const pool = sdk.Pools.loadPool(token.id);
  if (!pool.isInitialized) {
    pool.initialize("Stakers Pool", "gAVAX", [token.id], null);
  }

  const gAVAX = GAVAX.bind(NetworkConfigs.getLSTAddress());
  const supply = gAVAX.totalSupply(
    BigInt.fromString(NetworkConfigs.getProtocolIdBI())
  );
  pool.setInputTokenBalances([supply], true);

  const user = event.transaction.from;
  const account = sdk.Accounts.loadAccount(user);
  account.trackActivity();
}