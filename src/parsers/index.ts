import type { SourceParser } from "../types.js";
import { parseEasyStreet } from "./easyStreet.js";
import { parseJazzAlley } from "./jazzAlley.js";
import { parseNectar } from "./nectar.js";
import { parseRoyalRoom } from "./royalRoom.js";
import { parseSeaMonster } from "./seaMonster.js";
import { parseStg } from "./stg.js";
import { parseSunset } from "./sunset.js";
import { parseTractor } from "./tractor.js";

export const parsers: Record<string, SourceParser> = {
  tractor: parseTractor,
  sunset: parseSunset,
  royalRoom: parseRoyalRoom,
  jazzAlley: parseJazzAlley,
  nectar: parseNectar,
  seaMonster: parseSeaMonster,
  easyStreet: parseEasyStreet,
  stg: parseStg
};
