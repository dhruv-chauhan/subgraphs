import { Configurations } from "../../../../../configurations/configurations/interface";
import {
  PROTOCOL_NAME,
  PROTOCOL_SLUG,
} from "../../../../../src/common/constants";
import { Network } from "../../../../../src/sdk/util/constants";

export class TarotFantomConfigurations implements Configurations {
  getNetwork(): string {
    return Network.FANTOM;
  }
  getProtocolId(): string {
    return "0xe034c865299da16a429dad26bff5468c2689f7d8";
  }
  getProtocolName(): string {
    return PROTOCOL_NAME;
  }
  getProtocolSlug(): string {
    return PROTOCOL_SLUG;
  }
}
