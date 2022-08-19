import { getNetworkConfigurations } from "./configurations/configurations";
import { Deploy } from "./configurations/deploy";

let deployment = Deploy.TORNADOCASH_MAINNET;

export const NetworkConfigs = getNetworkConfigurations(deployment);
