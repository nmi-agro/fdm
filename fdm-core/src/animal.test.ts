import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  addAnimal,
  addAnimalsToHerd,
  assignAnimalToHerd,
  createHerdWithAnimals,
  getAnimal,
  getAnimalAssignmentHistory,
  getAnimalsForFarm,
  getAnimalsForHerd,
  getCensusForFarm,
  leaveHerd,
  reassignHerdAnimals,
  removeAnimal,
  removeAnimalAssigning,
  removeAnimals,
  removeAnimalsFromHerd,
  updateAnimal,
  updateAnimalAssigning,
} from "./animal"
import { syncAnimalCategoryCatalogueArray } from "./catalogues"
import { addFarm } from "./farm"
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
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
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
      l_id_category: "rvo_100",
    })
  })

  it("should create, read, update, list, and remove an animal", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL123456782",
      l_id_worknumber: "0123",
      l_specie: "cattle",
      l_sex: "female",
    })

    expect(l_id_animal).toBeDefined()

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_id_eartag).toBe("NL123456782")
    expect(animal.l_id_worknumber).toBe("0123")
    expect(animal.l_sex).toBe("female")
    expect(animal.l_id_herd).toBe(l_id_herd)
    expect(animal.l_id_category).toBe("rvo_100")
    expect(animal.l_category).toBe("100 - Melk- en kalfkoeien")
    expect(animal.l_lsu).toBe(1)

    await updateAnimal(fdm, principal_id, l_id_animal, {
      l_breed: "Holstein Friesian",
    })

    const updated = await getAnimal(fdm, principal_id, l_id_animal)
    expect(updated.l_breed).toBe("Holstein Friesian")

    const herdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(herdAnimals.length).toBe(1)

    const farmAnimals = await getAnimalsForFarm(fdm, principal_id, b_id_farm)
    expect(farmAnimals.length).toBe(1)

    await removeAnimal(fdm, principal_id, l_id_animal)
    const remainingHerdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(remainingHerdAnimals.length).toBe(0)

    // Hard delete: the animal record itself is gone (checkPermission fails
    // closed since the resource chain can no longer resolve the animal)
    await expect(getAnimal(fdm, principal_id, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should bulk add animals to herd via addAnimalsToHerd and remove some via removeAnimals", async () => {
    // Add 10 animals
    const animalIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 10)
    expect(animalIds.length).toBe(10)
    const createdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(createdAnimals.map((animal) => animal.l_id_worknumber).sort()).toEqual(
      Array.from({ length: 10 }, (_, index) => String(10001 + index)).sort(),
    )
    await expect(
      addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_worknumber: "10001" }),
    ).rejects.toThrowError("Exception for addAnimal")

    let census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const melkkoeienCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(melkkoeienCensus?.count).toBe(10)

    // Explicitly remove 3 specific animals
    await removeAnimals(fdm, principal_id, animalIds.slice(0, 3))

    census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const updatedCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(updatedCensus?.count).toBe(7)

    // Hard delete: the removed animals no longer exist (checkPermission
    // fails closed since the resource chain can no longer resolve them)
    await expect(getAnimal(fdm, principal_id, animalIds[0])).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reassign an animal to a different existing herd via assignAnimalToHerd and preserve history", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987654311",
    })

    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })

    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    const updatedAnimal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(updatedAnimal.l_id_herd).toBe(targetHerdId)

    // A second, distinct herd sharing the same category is allowed and is a
    // separate destination - the caller always names the herd explicitly.
    const secondHerdSameCategory = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee 2",
      l_id_category: "rvo_101",
    })
    expect(secondHerdSameCategory).not.toBe(targetHerdId)

    const l_id_animal2 = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987654328",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal2, secondHerdSameCategory)
    const updatedAnimal2 = await getAnimal(fdm, principal_id, l_id_animal2)
    expect(updatedAnimal2.l_id_herd).toBe(secondHerdSameCategory)
  })

  it("should move an animal on a past date to the chosen herd of another category via assignAnimalToHerd", async () => {
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    // A second dairy herd: the caller chooses which one the heifer joins
    const secondDairyHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien 2",
      l_id_category: "rvo_100",
    })
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, youngstockHerd, {
      l_sex: "female",
      l_arriving_date: new Date("2025-01-01"),
    })

    // A calving recorded afterwards: the herds have no start date, so they run on that date
    const calvingDate = new Date("2025-03-01")
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, secondDairyHerd, calvingDate)

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_id_herd).toBe(secondDairyHerd)
    expect(animal.l_id_category).toBe("rvo_100")

    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history).toHaveLength(2)
    expect(history.filter((row) => row.l_assigning_end === null)).toHaveLength(1)
    const closed = history.find((row) => row.l_id_herd === youngstockHerd)
    expect(closed?.l_assigning_end).toEqual(calvingDate)
    expect(history.find((row) => row.l_id_herd === secondDairyHerd)?.l_assigning_start).toEqual(
      calvingDate,
    )
  })

  it("should reject assignAnimalToHerd when the target herd does not run on the date", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_sex: "female",
      l_arriving_date: new Date("2025-01-01"),
    })
    const laterHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Pinken",
      l_id_category: "rvo_102",
      l_start: new Date("2025-04-01"),
    })
    const endedHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Oude koppel",
      l_id_category: "rvo_102",
      l_end: new Date("2025-02-01"),
    })

    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, laterHerd, new Date("2025-03-01")),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("has not started yet") } })
    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, endedHerd, new Date("2025-03-01")),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("has already ended") } })

    // From its start date on, the herd can be chosen
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, laterHerd, new Date("2025-04-01"))
    expect((await getAnimal(fdm, principal_id, l_id_animal)).l_id_herd).toBe(laterHerd)
  })

  it("should give a new herd no start date and reject assigning to a herd before it starts", async () => {
    const herd = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(herd.find((h) => h.l_id_herd === l_id_herd)?.l_start).toBeNull()

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_sex: "female",
      l_arriving_date: new Date("2025-01-01"),
    })
    const futureHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Nieuwe koppel",
      l_id_category: "rvo_100",
      l_start: new Date(Date.now() + 30 * 86_400_000),
    })

    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, futureHerd),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("has not started yet") } })
    await expect(
      reassignHerdAnimals(fdm, principal_id, l_id_herd, futureHerd),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("has not started yet") } })

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_id_herd).toBe(l_id_herd)
  })

  it("should reject invalid moves via assignAnimalToHerd", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_sex: "female",
      l_arriving_date: new Date("2025-01-01"),
    })
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    const pigHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Varkens",
      l_id_category: "rvo_407",
    })

    // Already in that herd
    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, l_id_herd),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("already belongs") } })
    // Before the current assignment started
    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, new Date("2024-12-01")),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("before the current herd assignment") },
    })
    // A herd of another species
    await expect(assignAnimalToHerd(fdm, principal_id, l_id_animal, pigHerd)).rejects.toThrowError(
      "Exception for assignAnimalToHerd",
    )

    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history).toHaveLength(1)
  })

  it("should reject assignAnimalToHerd when the target herd belongs to another farm", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987600004",
    })

    const otherFarmId = await addFarm(
      fdm,
      principal_id,
      "Other Farm for Reassignment",
      "654322",
      "Other Street 2",
      "4321BB",
    )
    const otherHerdId = await addHerd(fdm, principal_id, otherFarmId, {
      l_herd_name: "Andere kudde",
      l_id_category: "rvo_100",
    })

    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, otherHerdId),
    ).rejects.toThrowError("Exception for assignAnimalToHerd")
  })

  it("should create a herd with a specific number of animals via createHerdWithAnimals", async () => {
    const { l_id_herd: newHerdId, l_id_animals } = await createHerdWithAnimals(
      fdm,
      principal_id,
      b_id_farm,
      { l_herd_name: "Nieuwe kudde", l_id_category: "rvo_100" },
      5,
      { l_specie: "cattle", l_arriving_method: "purchased" },
    )

    expect(l_id_animals.length).toBe(5)

    const herdAnimals = await getAnimalsForHerd(fdm, principal_id, newHerdId)
    expect(herdAnimals.length).toBe(5)
    expect(herdAnimals.every((a) => a.l_specie === "cattle")).toBe(true)
    expect(herdAnimals.every((a) => a.l_arriving_method === "purchased")).toBe(true)
  })

  it("should correct an animal_assigning record via updateAnimalAssigning", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000010",
      l_arriving_date: new Date("2025-01-01"),
    })

    const before = await getAnimal(fdm, principal_id, l_id_animal)
    const originalStart = before.l_arriving_date as Date

    // A correction can move the start later, but not before the arrival
    const correctedStart = new Date(originalStart.getTime() + 86_400_000)
    await updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, originalStart, {
      l_assigning_start: correctedStart,
    })

    const after = await getAnimal(fdm, principal_id, l_id_animal)
    expect(after.l_id_herd).toBe(l_id_herd)

    // Correcting to a herd on another farm must be rejected
    const otherFarmId = await addFarm(
      fdm,
      principal_id,
      "Other Farm for Assigning Correction",
      "654323",
      "Other Street 3",
      "4321BC",
    )
    const otherHerdId = await addHerd(fdm, principal_id, otherFarmId, {
      l_herd_name: "Andere kudde 2",
      l_id_category: "rvo_100",
    })

    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, correctedStart, {
        l_id_herd: otherHerdId,
      }),
    ).rejects.toThrowError("Exception for updateAnimalAssigning")
  })

  it("should hard-delete an animal_assigning record via removeAnimalAssigning", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000027",
    })
    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    const assigningStart = animal.l_arriving_date as Date

    await removeAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, assigningStart)

    const herdAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(herdAnimals.find((a) => a.l_id_animal === l_id_animal)).toBeUndefined()

    // Removing a record that no longer exists is rejected
    await expect(
      removeAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, assigningStart),
    ).rejects.toThrowError("Exception for removeAnimalAssigning")
  })

  it("should compute census at a specific date", async () => {
    const evalDate = new Date("2025-06-01")
    const census = await getCensusForFarm(fdm, principal_id, b_id_farm, evalDate)
    expect(census).toBeDefined()
  })

  it("should keep herd in census with count 0 when all animals have left (soft) or been removed (hard)", async () => {
    const leftAnimal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000034",
    })
    // Record departure while preserving history
    await updateAnimal(fdm, principal_id, leftAnimal, {
      l_leaving_date: new Date(Date.now() - 60_000),
      l_leaving_method: "sold",
    })
    const leftAnimalDetails = await getAnimal(fdm, principal_id, leftAnimal)
    expect(leftAnimalDetails.l_leaving_method).toBe("sold")

    // Recording a departure also closes the animal's active herd assignment
    const herdAnimalsAfterLeaving = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(herdAnimalsAfterLeaving.find((a) => a.l_id_animal === leftAnimal)).toBeUndefined()

    const removedAnimal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000041",
    })
    // Hard delete entirely
    await removeAnimal(fdm, principal_id, removedAnimal)

    const census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const herdCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(herdCensus).toBeDefined()
    expect(herdCensus?.count).toBe(0)
  })

  it("should return animals present at a historical status date and their assignment history", async () => {
    const arrivingDate = new Date("2025-01-01T00:00:00.000Z")
    const leavingDate = new Date("2025-08-01T00:00:00.000Z")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000058",
      l_arriving_date: arrivingDate,
      l_leaving_date: leavingDate,
      l_leaving_method: "sold",
    })

    const presentOnJulyFirst = await getAnimalsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      new Date("2025-07-01T23:59:59.999Z"),
    )
    expect(presentOnJulyFirst.map((animal) => animal.l_id_animal)).toContain(l_id_animal)

    const presentAfterLeaving = await getAnimalsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      new Date("2025-08-02T00:00:00.000Z"),
    )
    expect(presentAfterLeaving.map((animal) => animal.l_id_animal)).not.toContain(l_id_animal)

    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history).toHaveLength(1)
    expect(history[0].l_id_herd).toBe(l_id_herd)
  })

  it("should leave every animal when a herd leaves the farm", async () => {
    const animalIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 3, {
      l_specie: "cattle",
      l_arriving_method: "purchased",
    })
    const leavingDate = new Date(Date.now() + 60_000)

    const leftAnimalIds = await leaveHerd(fdm, principal_id, l_id_herd, leavingDate, "sold")
    expect(leftAnimalIds.sort()).toEqual(animalIds.sort())

    // Until the leaving date the herd and its animals are still there
    expect(
      (await getAnimalsForHerd(fdm, principal_id, l_id_herd)).map((a) => a.l_id_animal).sort(),
    ).toEqual(animalIds.sort())
    for (const l_id_animal of animalIds) {
      const animal = await getAnimal(fdm, principal_id, l_id_animal)
      expect(animal.l_leaving_date?.toISOString()).toBe(leavingDate.toISOString())
      expect(animal.l_leaving_method).toBe("sold")
      expect(animal.l_id_herd).toBe(l_id_herd)
    }
    const censusBefore = await getCensusForFarm(fdm, principal_id, b_id_farm)
    expect(censusBefore.find((c) => c.l_id_herd === l_id_herd)?.count).toBe(3)

    // From the leaving date on, the herd is no longer in the census and the animals are gone
    const afterLeaving = new Date(leavingDate.getTime() + 1000)
    const censusAfter = await getCensusForFarm(fdm, principal_id, b_id_farm, afterLeaving)
    expect(censusAfter.find((c) => c.l_id_herd === l_id_herd)).toBeUndefined()
    const farmAnimalsAfter = await getAnimalsForFarm(fdm, principal_id, b_id_farm, afterLeaving)
    expect(farmAnimalsAfter.filter((a) => animalIds.includes(a.l_id_animal))).toEqual([])
  })

  it("should reassign every active animal in a herd together", async () => {
    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    const animalIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 2)
    const reassignmentDate = new Date(Date.now() + 60_000)

    const reassignedAnimalIds = await reassignHerdAnimals(
      fdm,
      principal_id,
      l_id_herd,
      targetHerdId,
      reassignmentDate,
    )

    expect(reassignedAnimalIds.sort()).toEqual(animalIds.sort())

    // Until the reassignment date the animals are still in the source herd
    expect(
      (await getAnimalsForHerd(fdm, principal_id, l_id_herd)).map((a) => a.l_id_animal).sort(),
    ).toEqual(animalIds.sort())
    expect(await getAnimalsForHerd(fdm, principal_id, targetHerdId)).toEqual([])

    // From that date on they are in the target herd
    const afterReassignment = new Date(reassignmentDate.getTime() + 1000)
    const farmAnimals = await getAnimalsForFarm(fdm, principal_id, b_id_farm, afterReassignment)
    for (const l_id_animal of animalIds) {
      const animal = farmAnimals.find((a) => a.l_id_animal === l_id_animal)
      expect(animal?.l_id_herd).toBe(targetHerdId)
      expect(animal?.l_leaving_date).toBeNull()
    }
  })

  it("should keep an animal with a future departure in its herd until it leaves", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_sex: "female",
      l_arriving_date: new Date("2025-01-01"),
    })
    const departure = new Date(Date.now() + 7 * 86_400_000)
    await updateAnimal(fdm, principal_id, l_id_animal, {
      l_leaving_date: departure,
      l_leaving_method: "sold",
    })

    expect((await getAnimal(fdm, principal_id, l_id_animal)).l_id_herd).toBe(l_id_herd)
    expect(
      (await getAnimalsForHerd(fdm, principal_id, l_id_herd)).map((a) => a.l_id_animal),
    ).toContain(l_id_animal)

    // A reduction does not pick an animal that is already leaving
    await expect(removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 1)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("exceeds current active census") },
    })

    // Moving the animal keeps its departure: the new assignment ends on the departure date
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    const moveDate = new Date("2025-03-01")
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, moveDate)
    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history).toHaveLength(2)
    expect(history.find((row) => row.l_id_herd === l_id_herd)?.l_assigning_end).toEqual(moveDate)
    expect(history.find((row) => row.l_id_herd === youngstockHerd)?.l_assigning_end).toEqual(
      departure,
    )

    // Moving the departure moves the end of the assignment along; clearing it reopens it
    const laterDeparture = new Date(departure.getTime() + 86_400_000)
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: laterDeparture })
    let current = (await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)).find(
      (row) => row.l_id_herd === youngstockHerd,
    )
    expect(current?.l_assigning_end).toEqual(laterDeparture)
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: null })
    current = (await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)).find(
      (row) => row.l_id_herd === youngstockHerd,
    )
    expect(current?.l_assigning_end).toBeNull()
  })

  it("should check the numbers again when a corrected departure makes an animal present", async () => {
    const departed = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_worknumber: "0777",
      l_arriving_date: new Date("2025-01-01"),
      l_leaving_date: new Date("2025-02-01"),
      l_leaving_method: "sold",
    })
    // The departed animal's work number may be used again
    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_worknumber: "0777" })

    // Undoing the departure would give two present animals the same work number
    await expect(
      updateAnimal(fdm, principal_id, departed, { l_leaving_date: null }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("is already used") } })
  })

  it("should only count herds in the census that run on the census date", async () => {
    const laterHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Pinken",
      l_id_category: "rvo_102",
      l_start: new Date("2025-06-01"),
      l_end: new Date("2025-09-01"),
    })

    const before = await getCensusForFarm(fdm, principal_id, b_id_farm, new Date("2025-05-01"))
    expect(before.find((c) => c.l_id_herd === laterHerd)).toBeUndefined()
    const during = await getCensusForFarm(fdm, principal_id, b_id_farm, new Date("2025-07-01"))
    expect(during.find((c) => c.l_id_herd === laterHerd)?.count).toBe(0)
    const after = await getCensusForFarm(fdm, principal_id, b_id_farm, new Date("2025-09-01"))
    expect(after.find((c) => c.l_id_herd === laterHerd)).toBeUndefined()
  })

  it("should reject adding animals to a herd that does not run yet", async () => {
    const futureStart = new Date(Date.now() + 30 * 86_400_000)
    const laterHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Pinken",
      l_id_category: "rvo_102",
      l_start: futureStart,
    })
    const notStarted = { cause: { message: expect.stringContaining("has not started yet") } }

    await expect(addAnimal(fdm, principal_id, b_id_farm, laterHerd)).rejects.toMatchObject(
      notStarted,
    )
    await expect(addAnimalsToHerd(fdm, principal_id, laterHerd, 2)).rejects.toMatchObject(
      notStarted,
    )
    await expect(
      createHerdWithAnimals(
        fdm,
        principal_id,
        b_id_farm,
        { l_herd_name: "Later", l_id_category: "rvo_102", l_start: futureStart },
        2,
      ),
    ).rejects.toMatchObject(notStarted)
    // From its start date on the herd takes animals
    await addAnimal(fdm, principal_id, b_id_farm, laterHerd, { l_arriving_date: futureStart })
  })

  it("should reject an invalid number of animals in the bulk helpers", async () => {
    const invalid = { cause: { message: expect.stringContaining("Invalid number of animals") } }
    await expect(addAnimalsToHerd(fdm, principal_id, l_id_herd, 2.5)).rejects.toMatchObject(invalid)
    await expect(addAnimalsToHerd(fdm, principal_id, l_id_herd, -1)).rejects.toMatchObject(invalid)
    await expect(
      removeAnimalsFromHerd(fdm, principal_id, l_id_herd, Number.POSITIVE_INFINITY),
    ).rejects.toMatchObject(invalid)
    await expect(
      createHerdWithAnimals(
        fdm,
        principal_id,
        b_id_farm,
        { l_herd_name: "Kudde", l_id_category: "rvo_100" },
        Number.NaN,
      ),
    ).rejects.toMatchObject(invalid)
    expect(await removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 0)).toEqual([])
  })

  it("should reject a bulk change made from a stale count", async () => {
    const changed = {
      cause: { message: expect.stringContaining("Number of animals in the herd has changed") },
    }
    // Two clients both see an empty herd; the first change applies, the second is stale
    await addAnimalsToHerd(fdm, principal_id, l_id_herd, 1, undefined, { expected_count: 0 })
    await expect(
      addAnimalsToHerd(fdm, principal_id, l_id_herd, 2, undefined, { expected_count: 0 }),
    ).rejects.toMatchObject(changed)
    await expect(
      removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 1, undefined, { expected_count: 2 }),
    ).rejects.toMatchObject(changed)
    expect(await getAnimalsForHerd(fdm, principal_id, l_id_herd)).toHaveLength(1)

    // With the current count both helpers apply
    await addAnimalsToHerd(fdm, principal_id, l_id_herd, 2, undefined, { expected_count: 1 })
    expect(
      await removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 1, undefined, {
        expected_count: 3,
      }),
    ).toHaveLength(1)
    expect(await getAnimalsForHerd(fdm, principal_id, l_id_herd)).toHaveLength(2)
  })

  it("should skip work numbers too large to count from", async () => {
    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_worknumber: "99999999999999999999",
    })
    const [l_id_animal] = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 1)
    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(Number(animal.l_id_worknumber)).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })

  it("should validate corrections of a herd assignment", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, new Date("2025-03-01"))

    // The end must come after the start
    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, new Date("2025-01-01"), {
        l_assigning_end: new Date("2024-12-01"),
      }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("must be after") } })
    // A correction may not overlap the animal's other assignment
    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, new Date("2025-01-01"), {
        l_assigning_end: new Date("2025-04-01"),
      }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("overlaps another assignment") },
    })
    // Moving only the start into a period when the herd did not run yet is rejected
    const laterHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Pinken",
      l_id_category: "rvo_101",
      l_start: new Date("2025-02-15"),
    })
    await updateAnimalAssigning(
      fdm,
      principal_id,
      l_id_animal,
      youngstockHerd,
      new Date("2025-03-01"),
      { l_id_herd: laterHerd },
    )
    // Shorten the first assignment, so only the herd check is left
    await updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, new Date("2025-01-01"), {
      l_assigning_end: new Date("2025-01-20"),
    })
    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, laterHerd, new Date("2025-03-01"), {
        l_assigning_start: new Date("2025-02-01"),
      }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("has not started yet") } })
  })

  it("should reject a departure before a move that is already recorded", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, new Date("2025-03-01"))

    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-02-01") }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("before the move to another herd") },
    })
    // A departure after the move closes the last assignment
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-04-01") })
    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history.find((row) => row.l_id_herd === youngstockHerd)?.l_assigning_end).toEqual(
      new Date("2025-04-01"),
    )
  })

  it("should reject a departure before a move at the moment of arrival", async () => {
    const arrival = new Date("2025-01-01")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: arrival,
    })
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    // The move starts at the same moment as the arrival
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, arrival)

    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2024-12-01") }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("before the move to another herd") },
    })
  })

  it("should only move the end of the last assignment when a departure is corrected", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const youngstockHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    // A move and a departure on the same day: both assignments end on March 1
    const moveDate = new Date("2025-03-01")
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, youngstockHerd, moveDate)
    await removeAnimalsFromHerd(fdm, principal_id, youngstockHerd, 1, {
      l_leaving_date: moveDate,
      l_leaving_method: "sold",
    })

    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-04-01") })
    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history.find((row) => row.l_id_herd === l_id_herd)?.l_assigning_end).toEqual(moveDate)
    expect(history.find((row) => row.l_id_herd === youngstockHerd)?.l_assigning_end).toEqual(
      new Date("2025-04-01"),
    )
  })

  it("should not count an empty assignment as an overlap", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const herdB = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "B",
      l_id_category: "rvo_100",
    })
    const herdC = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "C",
      l_id_category: "rvo_100",
    })
    // Two moves on one day leave B with an empty assignment [February 1, February 1)
    const moveDate = new Date("2025-02-01")
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, herdB, moveDate)
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, herdC, moveDate)

    await updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, new Date("2025-01-01"), {
      l_assigning_end: new Date("2025-01-20"),
    })
    await updateAnimalAssigning(fdm, principal_id, l_id_animal, herdC, moveDate, {
      l_assigning_start: new Date("2025-01-25"),
    })
    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history.find((row) => row.l_id_herd === herdC)?.l_assigning_start).toEqual(
      new Date("2025-01-25"),
    )

    // A departure closes C, the open assignment, not the emptied B that starts later
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-03-01") })
    const afterDeparture = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(afterDeparture.find((row) => row.l_id_herd === herdC)?.l_assigning_end).toEqual(
      new Date("2025-03-01"),
    )
    expect(afterDeparture.find((row) => row.l_id_herd === herdB)?.l_assigning_end).toEqual(moveDate)
    // Moving the departure moves the end of C again
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-03-05") })
    const moved = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(moved.find((row) => row.l_id_herd === herdC)?.l_assigning_end).toEqual(
      new Date("2025-03-05"),
    )
  })

  it("should not reopen an assignment beyond the end of its herd", async () => {
    const herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Ending",
      l_id_category: "rvo_100",
    })
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const end = new Date("2025-02-01")
    await leaveHerd(fdm, principal_id, herd, end, "sold")

    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: null }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("end of its herd") } })
    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-03-01") }),
    ).rejects.toMatchObject({ cause: { message: expect.stringContaining("end of its herd") } })
    // A correction within the herd's period still works
    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-01-20") })
    expect((await getAnimal(fdm, principal_id, l_id_animal)).l_leaving_date).toEqual(
      new Date("2025-01-20"),
    )
  })

  it("should count the expected number on the leaving date of a scheduled reduction", async () => {
    const herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Scheduled",
      l_id_category: "rvo_100",
    })
    await addAnimalsToHerd(fdm, principal_id, herd, 3)
    const nextWeek = new Date(Date.now() + 7 * 86_400_000)

    // Two clients saw three animals and each schedules one departure for next week
    await removeAnimalsFromHerd(
      fdm,
      principal_id,
      herd,
      1,
      { l_leaving_date: nextWeek },
      {
        expected_count: 3,
      },
    )
    await expect(
      removeAnimalsFromHerd(
        fdm,
        principal_id,
        herd,
        1,
        { l_leaving_date: nextWeek },
        {
          expected_count: 3,
        },
      ),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Number of animals in the herd has changed") },
    })
  })

  it("should not start an assignment before the animal arrived", async () => {
    const herdB = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Arrival B",
      l_id_category: "rvo_100",
    })
    const arrival = new Date("2025-03-01")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: arrival,
    })
    const beforeArrival = {
      cause: { message: expect.stringContaining("before the animal arrived") },
    }

    // A correction cannot move the assignment before the arrival
    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, arrival, {
        l_assigning_start: new Date("2025-02-01"),
      }),
    ).rejects.toMatchObject(beforeArrival)

    // Also without any assignment left, a move cannot be dated before the arrival
    await removeAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, arrival)
    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, herdB, new Date("2025-02-01")),
    ).rejects.toMatchObject(beforeArrival)
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, herdB, arrival)
  })

  it("should only write the documented columns of an assignment correction", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const other = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    // A key added at runtime is ignored
    await updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, new Date("2025-01-01"), {
      l_assigning_end: new Date("2025-06-01"),
      l_id_animal: other,
    } as Parameters<typeof updateAnimalAssigning>[5])
    const history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history).toHaveLength(1)
    expect(history[0].l_assigning_end).toEqual(new Date("2025-06-01"))
    expect(await getAnimalAssignmentHistory(fdm, principal_id, other)).toHaveLength(1)
  })

  it("should not pick an animal that only arrives later in a reduction", async () => {
    const present = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000065",
      l_arriving_date: new Date("2025-01-01"),
    })
    // An untagged animal would be picked first, but it only arrives next month
    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date(Date.now() + 30 * 86_400_000),
    })

    const removed = await removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 1)
    expect(removed).toEqual([present])
  })

  it("should refuse a batch of automatic work numbers that cannot be counted exactly", async () => {
    await expect(
      addAnimalsToHerd(fdm, principal_id, l_id_herd, Number.MAX_SAFE_INTEGER - 5),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("No automatic work numbers left") },
    })
  })

  it("should count automatic work numbers of 16 digits when numbering on", async () => {
    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_worknumber: "999999999999999",
    })
    const [first] = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 1)
    const [second] = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 1)
    expect((await getAnimal(fdm, principal_id, first)).l_id_worknumber).toBe("1000000000000000")
    expect((await getAnimal(fdm, principal_id, second)).l_id_worknumber).toBe("1000000000000001")

    // Past the largest exact number, numbering is refused instead of reusing a number
    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_worknumber: String(Number.MAX_SAFE_INTEGER),
    })
    await expect(addAnimal(fdm, principal_id, b_id_farm, l_id_herd)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("No automatic work numbers left") },
    })
  })

  it("should take the latest move as the last assignment when two moves share a day", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    const herdB = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "B",
      l_id_category: "rvo_100",
    })
    const herdC = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "C",
      l_id_category: "rvo_100",
    })
    const moveDate = new Date("2025-02-01")
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, herdB, moveDate)
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, herdC, moveDate)

    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-03-01") })
    let history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history.find((row) => row.l_id_herd === herdB)?.l_assigning_end).toEqual(moveDate)
    expect(history.find((row) => row.l_id_herd === herdC)?.l_assigning_end).toEqual(
      new Date("2025-03-01"),
    )

    await updateAnimal(fdm, principal_id, l_id_animal, { l_leaving_date: new Date("2025-04-01") })
    history = await getAnimalAssignmentHistory(fdm, principal_id, l_id_animal)
    expect(history.find((row) => row.l_id_herd === herdB)?.l_assigning_end).toEqual(moveDate)
    expect(history.find((row) => row.l_id_herd === herdC)?.l_assigning_end).toEqual(
      new Date("2025-04-01"),
    )
  })

  it("should reject assigning an animal to a herd belonging to another farm", async () => {
    const otherFarmId = await addFarm(
      fdm,
      principal_id,
      "Other Farm for Animals",
      "654321",
      "Other Street 1",
      "4321BA",
    )
    const otherHerdId = await addHerd(fdm, principal_id, otherFarmId, {
      l_herd_name: "Andere kudde",
      l_id_category: "rvo_100",
    })

    await expect(
      addAnimal(fdm, principal_id, b_id_farm, otherHerdId, {
        l_id_eartag: "NL800000002",
      }),
    ).rejects.toThrowError("Exception for addAnimal")
  })

  it("should sync l_birth_date and l_arriving_date when l_arriving_method is 'born'", async () => {
    const birthdate = new Date("2025-03-15")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL555111220",
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
    ).rejects.toThrowError("Exception for addAnimal")
  })

  it("should deny access to unauthorized principal", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL111111110",
    })

    const invalidUser = "unauthorized_user"
    await expect(getAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining animal functions", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL333333330",
    })
    const invalidUser = "unauthorized_user"

    await expect(
      addAnimal(fdm, invalidUser, b_id_farm, l_id_herd, { l_id_eartag: "NL444444440" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateAnimal(fdm, invalidUser, l_id_animal, { l_breed: "Jersey" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(removeAnimals(fdm, invalidUser, [l_id_animal])).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(addAnimalsToHerd(fdm, invalidUser, l_id_herd, 5)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(leaveHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    const otherHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })

    await expect(
      assignAnimalToHerd(fdm, invalidUser, l_id_animal, otherHerdId),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      reassignHerdAnimals(fdm, invalidUser, l_id_herd, otherHerdId),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      createHerdWithAnimals(
        fdm,
        invalidUser,
        b_id_farm,
        { l_herd_name: "Kudde", l_id_category: "rvo_101" },
        2,
      ),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateAnimalAssigning(fdm, invalidUser, l_id_animal, l_id_herd, new Date(), {
        l_assigning_end: new Date(),
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeAnimalAssigning(fdm, invalidUser, l_id_animal, l_id_herd, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getAnimalsForHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getAnimalsForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getCensusForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should add an animal with a non-'born' arriving method", async () => {
    const arrivingDate = new Date("2025-02-10")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL666666660",
      l_arriving_method: "purchased",
      l_arriving_date: arrivingDate,
    })

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_arriving_method).toBe("purchased")
    expect(animal.l_arriving_date?.toISOString()).toBe(arrivingDate.toISOString())
  })

  it("should enforce herd category species and sex compatibility", async () => {
    await expect(
      addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_specie: "sheep",
      }),
    ).rejects.toThrowError("Exception for addAnimal")

    await expect(
      addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_sex: "male",
      }),
    ).rejects.toThrowError("Exception for addAnimal")

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_sex: "female",
    })
    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_specie: "sheep" }),
    ).rejects.toThrowError("Exception for updateAnimal")
    await expect(
      updateAnimal(fdm, principal_id, l_id_animal, { l_sex: "male" }),
    ).rejects.toThrowError("Exception for updateAnimal")

    const sheepHerd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Schapen",
      l_id_category: "rvo_550",
    })
    const sheep = await addAnimal(fdm, principal_id, b_id_farm, sheepHerd)
    expect((await getAnimal(fdm, principal_id, sheep)).l_specie).toBe("sheep")

    await expect(
      assignAnimalToHerd(fdm, principal_id, l_id_animal, sheepHerd),
    ).rejects.toThrowError("Exception for assignAnimalToHerd")
  })

  it("should lower herd count preserving history via removeAnimalsFromHerd", async () => {
    // Add 2 identified animals and 3 placeholder animals (5 total)
    const identified1 = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000065",
      l_sex: "female",
    })
    const identified2 = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000072",
      l_sex: "female",
    })
    const placeholderIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 3)

    let census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    expect(census.find((c) => c.l_id_herd === l_id_herd)?.count).toBe(5)

    // Remove 2 animals - should remove 2 placeholder animals first
    const removedIds = await removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 2, {
      l_leaving_method: "sold",
    })
    expect(removedIds.length).toBe(2)
    // The removed animals should be placeholders
    for (const id of removedIds) {
      expect(placeholderIds).toContain(id)
      const animal = await getAnimal(fdm, principal_id, id)
      expect(animal.l_leaving_method).toBe("sold")
      expect(animal.l_leaving_date).toBeDefined()
    }

    census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    expect(census.find((c) => c.l_id_herd === l_id_herd)?.count).toBe(3)

    // Identified animals should still be present
    const remainingAnimals = await getAnimalsForHerd(fdm, principal_id, l_id_herd)
    expect(remainingAnimals.map((a) => a.l_id_animal)).toContain(identified1)
    expect(remainingAnimals.map((a) => a.l_id_animal)).toContain(identified2)

    // Should reject count exceeding remaining active census (3)
    await expect(removeAnimalsFromHerd(fdm, principal_id, l_id_herd, 5)).rejects.toThrowError(
      "Exception for removeAnimalsFromHerd",
    )
  })

  describe("life number and work number", () => {
    const causeMessage = (message: string) => ({
      cause: expect.objectContaining({ message: expect.stringContaining(message) }),
    })

    it("should normalize a Dutch life number and take the work number from it", async () => {
      const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: "NL 1300001 0001 9",
      })

      const animal = await getAnimal(fdm, principal_id, l_id_animal)
      expect(animal.l_id_eartag).toBe("NL130000100019")
      expect(animal.l_id_worknumber).toBe("0001")
    })

    it("should prefer an explicit work number over the derived one", async () => {
      const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: "NL101177210",
        l_id_worknumber: "42",
      })

      const animal = await getAnimal(fdm, principal_id, l_id_animal)
      expect(animal.l_id_worknumber).toBe("42")
    })

    it("should reject an invalid Dutch cattle life number", async () => {
      await expect(
        addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_eartag: "NL101177211" }),
      ).rejects.toMatchObject(causeMessage("invalid check digit"))
      await expect(
        addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_eartag: "NL12345" }),
      ).rejects.toMatchObject(causeMessage("not a valid Dutch cattle life number"))

      const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
      await expect(
        updateAnimal(fdm, principal_id, l_id_animal, { l_id_eartag: "NL130000100018" }),
      ).rejects.toMatchObject(causeMessage("invalid check digit"))
    })

    it("should keep foreign life numbers and non-cattle life numbers as entered", async () => {
      const foreign = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: " DE 01 234 56789 ",
      })
      const foreignAnimal = await getAnimal(fdm, principal_id, foreign)
      expect(foreignAnimal.l_id_eartag).toBe("DE 01 234 56789")
      expect(foreignAnimal.l_id_worknumber).toBe("10001")

      const sheepHerd = await addHerd(fdm, principal_id, b_id_farm, {
        l_herd_name: "Schapen",
        l_id_category: "rvo_550",
      })
      const sheep = await addAnimal(fdm, principal_id, b_id_farm, sheepHerd, {
        l_id_eartag: "NL 123456 7 89012",
      })
      expect((await getAnimal(fdm, principal_id, sheep)).l_id_eartag).toBe("NL 123456 7 89012")
    })

    it("should only block numbers that an animal still on the farm uses", async () => {
      const first = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: "NL130000100019",
      })
      await expect(
        addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_worknumber: "0001" }),
      ).rejects.toMatchObject(causeMessage("Work number 0001 is already used"))
      await expect(
        addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
          l_id_eartag: "1300001 0001 9",
          l_id_worknumber: "7777",
        }),
      ).rejects.toMatchObject(causeMessage("Life number NL130000100019 is already used"))

      const second = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_worknumber: "0002",
      })
      await expect(
        updateAnimal(fdm, principal_id, second, { l_id_worknumber: "0001" }),
      ).rejects.toMatchObject(causeMessage("Work number 0001 is already used"))
      // Saving an animal's own numbers again is fine
      await updateAnimal(fdm, principal_id, first, {
        l_id_eartag: "NL130000100019",
        l_id_worknumber: "0001",
      })

      await updateAnimal(fdm, principal_id, first, {
        l_leaving_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        l_leaving_method: "sold",
      })

      // Once the first animal has left, its numbers can be used again
      const returned = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: "NL130000100019",
      })
      expect((await getAnimal(fdm, principal_id, returned)).l_id_worknumber).toBe("0001")
    })

    it("should keep auto-numbering after a placeholder animal gets its life number", async () => {
      const placeholders = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 3)

      await updateAnimal(fdm, principal_id, placeholders[0], {
        l_id_eartag: "NL 1011 7721 0",
        l_id_worknumber: "7721",
      })
      const identified = await getAnimal(fdm, principal_id, placeholders[0])
      expect(identified.l_id_eartag).toBe("NL101177210")
      expect(identified.l_id_worknumber).toBe("7721")

      const next = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
      expect((await getAnimal(fdm, principal_id, next)).l_id_worknumber).toBe("10004")
    })

    it("should clear a life number with an empty value", async () => {
      const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
        l_id_eartag: "NL101177210",
      })

      await updateAnimal(fdm, principal_id, l_id_animal, { l_id_eartag: "" })
      expect((await getAnimal(fdm, principal_id, l_id_animal)).l_id_eartag).toBeNull()
    })
  })
})
