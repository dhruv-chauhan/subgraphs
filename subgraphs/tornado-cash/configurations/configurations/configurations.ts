import { TornadoCashMainnetConfigurations } from "../../protocols/tornado-cash/config/networks/ethereum/ethereum";
import { Configurations } from "./interface";
import { Deploy } from "./deploy";
import { log } from "@graphprotocol/graph-ts";

export function getNetworkConfigurations(deploy: i32): Configurations {
  switch (deploy) {
    case Deploy.TORNADOCASH_MAINNET: {
      return new TornadoCashMainnetConfigurations();
    }
    default: {
      log.critical(
        "No configurations found for deployment protocol/network",
        []
      );
      return new TornadoCashMainnetConfigurations();
    }
  }
}
