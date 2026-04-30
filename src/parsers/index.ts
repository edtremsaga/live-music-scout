import type { SourceParser } from "../types.js";
import { parseBakesPlace } from "./bakesPlace.js";
import { parseChateauSteMichelle } from "./chateauSteMichelle.js";
import { parseConfiguredTodoSource } from "./configuredTodo.js";
import { parseEasyStreet } from "./easyStreet.js";
import { parseElCorazon } from "./elCorazon.js";
import { parseJazzAlley } from "./jazzAlley.js";
import { parseMarymoor } from "./marymoor.js";
import { parseHiddenHall, parseNectar } from "./nectar.js";
import { parseRoyalRoom } from "./royalRoom.js";
import { parseSeaMonster } from "./seaMonster.js";
import { parseSlims } from "./slims.js";
import { parseSkylark } from "./skylark.js";
import { parseStg } from "./stg.js";
import { parseSunset } from "./sunset.js";
import { parseTractor } from "./tractor.js";
import { parseTripleDoor } from "./tripleDoor.js";
import { parseZooTunes } from "./zooTunes.js";

export const parsers: Record<string, SourceParser> = {
  bakesPlace: parseBakesPlace,
  chateauSteMichelle: parseChateauSteMichelle,
  configuredTodo: parseConfiguredTodoSource,
  tractor: parseTractor,
  sunset: parseSunset,
  royalRoom: parseRoyalRoom,
  jazzAlley: parseJazzAlley,
  marymoor: parseMarymoor,
  tripleDoor: parseTripleDoor,
  hiddenHall: parseHiddenHall,
  nectar: parseNectar,
  skylark: parseSkylark,
  seaMonster: parseSeaMonster,
  easyStreet: parseEasyStreet,
  elCorazon: parseElCorazon,
  slims: parseSlims,
  stg: parseStg,
  zooTunes: parseZooTunes
};
