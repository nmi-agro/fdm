import type { CatalogueAnimalCategoryTransitions } from "../../d"

const female = ["female"] as const
const male = ["male"] as const
const femaleAndMale = ["female", "male"] as const

/**
 * The moves between the RVO animal categories (see `categories.ts` in this folder), per category
 * an animal is in. A move follows the life of the animal: it only goes to an older age group or
 * production stage of the same species, never back, and never to another species. Several
 * categories include the young of their animals (calves of breeding hinds, lambs on the farm where
 * they were born, piglets of sows), so the young move on from there. Categories that are not
 * listed have no move to another category: an animal in it stays there until it leaves the farm.
 * The categories and their descriptions follow RVO Tabel 4 Diergebonden normen 2026.
 */
export const rvoAnimalCategoryTransitions: CatalogueAnimalCategoryTransitions = {
  // Cattle: young stock grows up into a heifer, a breeding bull or a beef animal
  // A calf of the farm can also be kept as a veal calf (from ca. 14 days)
  rvo_101: [
    { to: ["rvo_102"], l_sex: female },
    { to: ["rvo_104"], l_sex: male },
    { to: ["rvo_112", "rvo_115", "rvo_116", "rvo_117", "rvo_122"], l_sex: femaleAndMale },
  ],
  // A heifer calves and joins the cows, or is fattened with the red meat cattle (122 includes
  // female animals fattened the same way)
  rvo_102: [{ to: ["rvo_100", "rvo_120", "rvo_122"], l_sex: female }],
  // A dairy cow can become a suckler cow and back
  rvo_100: [{ to: ["rvo_120"], l_sex: female }],
  rvo_120: [{ to: ["rvo_100"], l_sex: female }],
  // Start calves become rosé veal calves or red meat bulls
  rvo_115: [{ to: ["rvo_116", "rvo_122"], l_sex: femaleAndMale }],
  // Water buffalo: a young cow joins the water buffalo cows, a young bull the breeding bulls
  rvo_992: [
    { to: ["rvo_991"], l_sex: female },
    { to: ["rvo_104"], l_sex: male },
  ],
  // Sheep: lambs up to ca. 4 months on the farm where they were born are counted with 550
  rvo_550: [{ to: ["rvo_552"], l_sex: femaleAndMale }],
  rvo_551: [{ to: ["rvo_552"], l_sex: femaleAndMale }],
  rvo_552: [{ to: ["rvo_550"], l_sex: femaleAndMale }],
  // Goats: newborn kids are counted with 600, and 600 includes the mature bucks
  rvo_600: [{ to: ["rvo_601"], l_sex: femaleAndMale }],
  rvo_601: [
    { to: ["rvo_602"], l_sex: female },
    { to: ["rvo_600"], l_sex: male },
  ],
  rvo_602: [{ to: ["rvo_600"], l_sex: female }],
  // Red deer: calves younger than 6 months are counted with the breeding hinds (971); a deer kept
  // for slaughter can still join the breeding stock
  rvo_971: [{ to: ["rvo_973"], l_sex: femaleAndMale }],
  rvo_973: [{ to: ["rvo_974", "rvo_971"], l_sex: femaleAndMale }],
  rvo_974: [{ to: ["rvo_971"], l_sex: femaleAndMale }],
  // Fallow deer: calves younger than 3 months are counted with the breeding hinds (981)
  rvo_981: [{ to: ["rvo_982"], l_sex: femaleAndMale }],
  // Pigs: weaned piglets grow into rearing or fattening pigs, rearing pigs into sows or boars.
  // Piglets up to ca. 25 kg are counted with their sow (401) and move on from there
  rvo_407: [{ to: ["rvo_404", "rvo_411"], l_sex: femaleAndMale }],
  rvo_404: [
    { to: ["rvo_400", "rvo_401"], l_sex: female },
    { to: ["rvo_406"], l_sex: male },
  ],
  rvo_400: [{ to: ["rvo_401"], l_sex: female }],
  rvo_401: [
    { to: ["rvo_400"], l_sex: female },
    { to: ["rvo_404", "rvo_411"], l_sex: femaleAndMale },
  ],
  // Rabbits: young rabbits are counted with the breeding does (900) until they are weaned
  rvo_900: [{ to: ["rvo_901"], l_sex: femaleAndMale }],
  // Poultry
  rvo_300: [{ to: ["rvo_301"], l_sex: femaleAndMale }],
  rvo_310: [{ to: ["rvo_311"], l_sex: femaleAndMale }],
  // Turkeys
  rvo_200: [{ to: ["rvo_201", "rvo_210"], l_sex: femaleAndMale }],
  rvo_201: [{ to: ["rvo_202"], l_sex: femaleAndMale }],
  // Ducks
  rvo_802: [{ to: ["rvo_803"], l_sex: femaleAndMale }],
}
