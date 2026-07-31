export interface QuestGuideImage {
  src: string;
  caption: string;
}

const SCALE_TO_WIDTH_SEGMENT_PATTERN = /\/scale-to-width-down\/\d+/;

/**
 * Recovers the original full-resolution image from a curated `src` below,
 * for `QuestGuideImageLightbox`. Every `src` in this file is a Fandom/Wikia
 * CDN thumbnail URL ending in
 * `/revision/latest/scale-to-width-down/{width}?cb=...` (kept deliberately
 * small/fast for the inline thumbnail grid) - Fandom's own convention is
 * that the identical image at full original resolution lives at the same
 * URL with just that `scale-to-width-down/{width}` segment removed
 * (`/revision/latest?cb=...`). Confirmed live against a real entry
 * (Shooting Cans' map screenshot): the scaled URL returned a ~22KB image,
 * the transformed URL returned the real ~519KB original, both HTTP 200 -
 * not assumed from the URL shape alone. Returns `src` unchanged if it
 * doesn't match the pattern (e.g. a future non-Fandom-hosted entry) rather
 * than guessing at a transform that might not apply.
 */
export function getFullResolutionImageUrl(src: string): string {
  return src.replace(SCALE_TO_WIDTH_SEGMENT_PATTERN, "");
}

/**
 * Curated per-quest wiki "Guide" screenshots (map markers, item/extract
 * locations), keyed directly by tarkov.dev task id - unlike
 * `ITEM_LOCATIONS`'s (`item-locations.ts`) fuzzy shortName/substring match
 * (needed because items have no single stable cross-source id), every task
 * already has one canonical `id` used throughout this app, so no resolver
 * function is needed here - just `QUEST_GUIDE_IMAGES[task.id]`.
 *
 * Sourced from each quest's own wiki page (see `task.wikiLink`) - drafted
 * by `scripts/scrape-quest-guide-images.mjs`, then hand-reviewed here
 * (deduped repeated images, dropped/rewrote a handful of blank captions
 * the wiki itself never set, confirmed `Out_of_Curiosity`/`Big_Customer`
 * genuinely share the same screenshots rather than a scrape bug - both
 * quests take place in the same Customs depot building). Intentionally
 * partial coverage (this starting batch: early Prapor/Therapist/Skier
 * quests with a location-based objective, the ones a screenshot actually
 * helps with) - a quest with no entry here simply shows no expand toggle,
 * see `QuestDetailDialog.tsx`'s `ObjectiveGuideImages`. `Ice_Cream_Cones`
 * was in the source batch but has no gallery images on its own wiki
 * Guide section, so it has no entry here either - not an oversight.
 */
export const QUEST_GUIDE_IMAGES: Readonly<Record<string, readonly QuestGuideImage[]>> = {
  // First in Line
  "657315ddab5a49b71f098853": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/c/c5/First_in_Line_Map.png/revision/latest/scale-to-width-down/311?cb=20240123113807",
      caption: "Location marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/a9/Ground_Zero_Emercom_Station.png/revision/latest/scale-to-width-down/450?cb=20250708202351",
      caption: "The Emercom station",
    },
  ],
  // Shooting Cans
  "657315df034d76585f032e01": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/dc/Shooting_Cans_Map.png/revision/latest/scale-to-width-down/311?cb=20240325032754",
      caption: "Location marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/26/Tarbank_Building.png/revision/latest/scale-to-width-down/450?cb=20250708202708",
      caption: "The Tarbank building",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/5/51/Tarbank_Building_Stairs.png/revision/latest/scale-to-width-down/450?cb=20250522211749",
      caption: "Way to the staircase",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/e/eb/Shooting_Cans_Utyos.png/revision/latest/scale-to-width-down/450?cb=20231230062117",
      caption: "The Utyos machine gun",
    },
  ],
  // Luxurious Life
  "657315e1dccd301f1301416a": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/c/c5/Luxurious_Life_Map.png/revision/latest/scale-to-width-down/311?cb=20240325021730",
      caption: "Liquor store marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/21/ASAP_Winery.png/revision/latest/scale-to-width-down/450?cb=20250708202108",
      caption: 'The "ASAP winery" liquor store',
    },
  ],
  // Background Check
  "5936da9e86f7742d65037edf": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/f/f2/Checking_Map.png/revision/latest/scale-to-width-down/450?cb=20220213230832",
      caption: "Room 205 location marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/47/DormRoom205Entrance.png/revision/latest/scale-to-width-down/450?cb=20221220200252",
      caption: "Room 205 entrance",
    },
  ],
  // Search Mission
  "5fd9fad9c1ce6b1a3b486d00": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/0/0c/Search_Mission_map.jpg/revision/latest/scale-to-width-down/466?cb=20240811142416",
      caption: "Convoy, camp, and landmine locations marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/0/0c/Search_Mission_Convoy.png/revision/latest/scale-to-width-down/450?cb=20260221222750",
      caption: "The convoy",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/dd/Search_mission_camp.png/revision/latest/scale-to-width-down/450?cb=20230307203957",
      caption: "The USEC camp",
    },
  ],
  // Delivery From the Past
  "59674eb386f774539f14813a": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/4a/Delivery_from_the_past_Customs.png/revision/latest/scale-to-width-down/450?cb=20220214002541",
      caption: "Warehouse marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/8/8a/Customs-Factory1-Outside-3.png/revision/latest/scale-to-width-down/450?cb=20230117183410",
      caption: "The warehouse",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/45/CustomsOffice.png/revision/latest/scale-to-width-down/450?cb=20230117184032",
      caption: "The office",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/5/5e/Farming3Office.png/revision/latest/scale-to-width-down/450?cb=20230117182707",
      caption: "The second room",
    },
  ],
  // BP Depot
  "59c124d686f774189b3c843f": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/3/39/BP_Depot_Marked_Map.png/revision/latest/scale-to-width-down/450?cb=20240729135604",
      caption: "Fuel tanker truck locations marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/5/51/BPTanker.png/revision/latest/scale-to-width-down/450?cb=20240729135637",
      caption: "Tanker truck #1 behind the new gas station",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/27/BPTanker2.png/revision/latest/scale-to-width-down/450?cb=20240729140300",
      caption: "Tanker truck #2 at the construction site with the fuel tanks",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/b/b1/BPTanker3.png/revision/latest/scale-to-width-down/450?cb=20240729140112",
      caption: 'Tanker truck #3 next to the "Old Gas Station" extraction',
    },
  ],
  // Operation Aquarius - Part 1
  "59689fbd86f7740d137ebfc4": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/9/92/OP_Aquarius1_Customs.png/revision/latest/scale-to-width-down/450?cb=20220211210242",
      caption: "2 story dorms and room 206 marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/de/Rom_206_door.png/revision/latest/scale-to-width-down/450?cb=20260416025126",
      caption: "Room 206 in the two-story dorms",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/9/99/Inside-Room-206.png/revision/latest/scale-to-width-down/450?cb=20180314234507",
      caption: "The hidden water",
    },
  ],
  // Bad Rep Evidence
  "5967530a86f77462ba22226b": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/c/c7/Bad_Rep_Evidence_Customs.png/revision/latest/scale-to-width-down/450?cb=20220815194155",
      caption: "Bunkhouse location marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/d0/Customs-Portable-cabin-portable.png/revision/latest/scale-to-width-down/450?cb=20250808234617",
      caption: "The bunkhouse",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/af/Docs_0031_location.png/revision/latest/scale-to-width-down/450?cb=20241230151756",
      caption: "The secure folder on the table",
    },
  ],
  // The Extortionist
  "596b43fb86f77457ca186186": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/6/66/Customs.PNG/revision/latest/scale-to-width-down/516?cb=20221204183402",
      caption: "Dead Scav and cabin marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/2f/The_bush_where_the_hidden_body_is.png/revision/latest/scale-to-width-down/450?cb=20220706015222",
      caption: "The dead Scav is located in a bush behind garages",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/a6/The_cabin_that_is_opened_by_the_unknown_key.png/revision/latest/scale-to-width-down/450?cb=20220820190601",
      caption: "The cabin that is opened with the key",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/c/c0/Docs_0048-The_Extortionist.png/revision/latest/scale-to-width-down/450?cb=20220821162246",
      caption: "The folder is located under a jacket on the floor",
    },
  ],
  // Golden Swag
  "5979eee086f774311955e614": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/20/GoldenSwagMarkedMap.png/revision/latest/scale-to-width-down/450?cb=20250712194517",
      caption: "3 story dorms, room 303 and cabin marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/e/e1/Gilded-Zibbo-Location.png/revision/latest/scale-to-width-down/450?cb=20240819153320",
      caption: "The lighter on a desk",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/dd/Trailer_park_cabin_key_location.png/revision/latest/scale-to-width-down/450?cb=20240819153742",
      caption: "The wanted cabin at the trailer park",
    },
  ],
  // Pharmacist
  "5969f9e986f7741dde183a50": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/ab/Pharmacist_Customs.png/revision/latest/scale-to-width-down/450?cb=20250712184929",
      caption: "2 story dorms and room 114 marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/7/7a/Carbon_Case_Location.png/revision/latest/scale-to-width-down/450?cb=20230607221153",
      caption: "The carbon case on the safe",
    },
  ],
  // Postman Pat - Part 1
  "59675ea386f77414b32bded2": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/b/b1/PostmanPat1_Factory.png/revision/latest/scale-to-width-down/449?cb=20240824191833",
      caption: "Bunker location marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/b/b4/PostmanPatLocation.png/revision/latest/scale-to-width-down/450?cb=20240824174819",
      caption: 'The wanted bunker, "1986" on the wall above it',
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/a6/Postman_Pat_Letter_Location.png/revision/latest/scale-to-width-down/450?cb=20240827160828",
      caption: "The letter on the ground",
    },
  ],
  // Out of Curiosity (shares the same Customs depot-building location/screenshots as Big Customer below - confirmed, not a scrape mismatch)
  "597a160786f77477531d39d2": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/e/ed/BigCustomerMap.jpg/revision/latest/scale-to-width-down/543?cb=20220129152928",
      caption: "Warehouse marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/6/64/Depot-building_customs.png/revision/latest/scale-to-width-down/450?cb=20250603195148",
      caption: "The warehouse with the vehicle inside",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/45/The_van_inside_the_depot-building.png/revision/latest/scale-to-width-down/450?cb=20250603195321",
      caption: "The vehicle where the beacon is placed",
    },
  ],
  // Big Customer
  "597a171586f77405ba6887d3": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/e/ed/BigCustomerMap.jpg/revision/latest/scale-to-width-down/543?cb=20220129152928",
      caption: "Warehouse marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/6/64/Depot-building_customs.png/revision/latest/scale-to-width-down/450?cb=20250603195148",
      caption: "The warehouse with the vehicle inside",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/45/The_van_inside_the_depot-building.png/revision/latest/scale-to-width-down/450?cb=20250603195321",
      caption: "The vehicle where the beacon is placed",
    },
  ],
  // Population Census
  "639135d89444fb141f4e6eea": [
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/f/f4/PopulationCensusMap.png/revision/latest/scale-to-width-down/363?cb=20230826235224",
      caption: "Housing department marked on map",
    },
    {
      src: "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/7/76/PopulationCensusBuilding.png/revision/latest/scale-to-width-down/450?cb=20230106233632",
      caption: "Housing department building backside with entrance",
    },
  ],
};
