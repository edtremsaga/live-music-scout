import type { SourceParser } from "../types.js";
import { parseBakesPlace } from "./bakesPlace.js";
import { parseConfiguredTodoSource } from "./configuredTodo.js";
import { parseEasyStreet } from "./easyStreet.js";
import { parseJazzAlley } from "./jazzAlley.js";
import { parseHiddenHall, parseNectar } from "./nectar.js";
import { parseRoyalRoom } from "./royalRoom.js";
import { parseSeaMonster } from "./seaMonster.js";
import { parseSkylark } from "./skylark.js";
import { parseStg } from "./stg.js";
import { parseSunset } from "./sunset.js";
import { parseTractor } from "./tractor.js";
import { parseTripleDoor } from "./tripleDoor.js";

export const parsers: Record<string, SourceParser> = {
  bakesPlace: parseBakesPlace,
  configuredTodo: parseConfiguredTodoSource,
  tractor: parseTractor,
  sunset: parseSunset,
  royalRoom: parseRoyalRoom,
  jazzAlley: parseJazzAlley,
  tripleDoor: parseTripleDoor,
  hiddenHall: parseHiddenHall,
  nectar: parseNectar,
  skylark: parseSkylark,
  seaMonster: parseSeaMonster,
  easyStreet: parseEasyStreet,
  stg: parseStg
};
