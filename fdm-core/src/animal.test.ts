import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  addAnimal,
  addAnimalsToHerd,
  getAnimal,
  getAnimalsForFarm,
  getAnimalsForHerd,
  getCensusForFarm,
  removeAnimal,
  setAnimalCategory,
  updateAnimal,
} from "./animal"
import { addFarm, getFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd, getHerdsForFarm } from "./herd"

describe("Animal Domain", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string
  let l_id_herd: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)
    principal_id = "test_principal"

    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Animals",
      "123456",
      "Farm Street 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })
  })

  it("should create, read, update, list, and remove an animal and set farm b_farm_livestock = true", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL123456789",
      l_id_worknumber: "0123",
      l_species: "cattle",
      l_sex: "female",
    })

    expect(l_id_animal).toBeDefined()

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_id_eartag).toBe("NL123456789")
    expect(animal.l_id_worknumber).toBe("0123")
    expect(animal.l_sex).toBe("female")
    expect(animal.l_id_herd).toBe(l_id_herd)

    // Check farm b_farm_livestock flag is set to true
    const farm = await getFarm(fdm, principal_id, b_id_farm)
    expect(farm.b_farm_livestock).toBe(true)

    await updateAnimal(fdm, principal_id, l_id_animal, {
      l_breed: "Holstein Friesian",
    })

    const updated = await getAnimal(fdm, principal_id, l_id_animal)
    expect(updated.l_breed).toBe("Holstein Friesian")

    const herdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(herdAnimals.length).toBe(1)

    const farmAnimals = await getAnimalsForFarm(fdm, principal_id, b_id_farm)
    expect(farmAnimals.length).toBe(1)

    await removeAnimal(fdm, principal_id, l_id_animal, "sold")
    const remainingHerdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(remainingHerdAnimals.length).toBe(0)
  })

  it("should bulk add animals to herd via addAnimalsToHerd and reduce count", async () => {
    // Add 10 animals
    const animalIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 10)
    expect(animalIds.length).toBe(10)

    let census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const melkkoeienCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(melkkoeienCensus?.count).toBe(10)

    // Reduce to 7 animals
    const reducedIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 7)
    expect(reducedIds.length).toBe(7)

    census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const updatedCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(updatedCensus?.count).toBe(7)
  })

  it("should reassign animal category via setAnimalCategory and preserve history", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987654321",
    })

    // Reassign animal to Jongvee category ("rvo_101")
    const targetHerdId = await setAnimalCategory(fdm, principal_id, l_id_animal, "rvo_101")
    expect(targetHerdId).toBeDefined()
    expect(targetHerdId).not.toBe(l_id_herd)

    const updatedAnimal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(updatedAnimal.l_id_herd).toBe(targetHerdId)

    // Verify a new herd for category rvo_101 was created on farm
    const farmHerds = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(farmHerds.map((h) => h.l_herd_category)).toEqual(
      expect.arrayContaining(["rvo_100", "rvo_101"]),
    )
  })

  it("should sync l_birth_date and l_arriving_date when l_arriving_method is 'born'", async () => {
    const birthdate = new Date("2025-03-15")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL555111222",
      l_arriving_method: "born",
      l_birth_date: birthdate,
    })

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_birth_date?.toISOString()).toBe(birthdate.toISOString())
    expect(animal.l_arriving_date?.toISOString()).toBe(birthdate.toISOString())

    // Reject conflicting birthdate and arriving date for born animals
    const conflictingDate = new Date("2025-04-01")
    await expect(
      addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_arriving_method: "born",
        l_birth_date: birthdate,
        l_arriving_date: conflictingDate,
      }),
    ).rejects.toThrowError("l_birth_date and l_arriving_date must be equal")
  })

  it("should deny access to unauthorized principal", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL111111111",
    })

    const invalidUser = "unauthorized_user"
    await expect(getAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
