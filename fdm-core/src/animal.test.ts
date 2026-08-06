import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  addAnimal,
  addAnimalsToHerd,
  assignAnimalToHerd,
  createHerdWithAnimals,
  getAnimal,
  getAnimalsForFarm,
  getAnimalsForHerd,
  getCensusForFarm,
  leaveHerd,
  reassignHerdAnimals,
  removeAnimal,
  removeAnimalAssigning,
  removeAnimals,
  updateAnimal,
  updateAnimalAssigning,
} from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"

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

  it("should create, read, update, list, and remove an animal", async () => {
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
      l_id_eartag: "NL987654321",
    })

    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_herd_category: "rvo_101",
    })

    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    const updatedAnimal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(updatedAnimal.l_id_herd).toBe(targetHerdId)

    // A second, distinct herd sharing the same category is allowed and is a
    // separate destination - the caller always names the herd explicitly.
    const secondHerdSameCategory = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee 2",
      l_herd_category: "rvo_101",
    })
    expect(secondHerdSameCategory).not.toBe(targetHerdId)

    const l_id_animal2 = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987654322",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal2, secondHerdSameCategory)
    const updatedAnimal2 = await getAnimal(fdm, principal_id, l_id_animal2)
    expect(updatedAnimal2.l_id_herd).toBe(secondHerdSameCategory)
  })

  it("should reject assignAnimalToHerd when the target herd belongs to another farm", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL987600001",
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
      l_herd_category: "rvo_100",
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
      { l_herd_name: "Nieuwe kudde", l_herd_category: "rvo_100" },
      5,
      { l_species: "cattle", l_arriving_method: "purchased" },
    )

    expect(l_id_animals.length).toBe(5)

    const herdAnimals = await getAnimalsForHerd(fdm, principal_id, newHerdId)
    expect(herdAnimals.length).toBe(5)
    expect(herdAnimals.every((a) => a.l_species === "cattle")).toBe(true)
    expect(herdAnimals.every((a) => a.l_arriving_method === "purchased")).toBe(true)

  })

  it("should correct an animal_assigning record via updateAnimalAssigning", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000010",
    })

    const before = await getAnimal(fdm, principal_id, l_id_animal)
    const originalStart = before.l_arriving_date as Date

    const correctedStart = new Date(originalStart.getTime() - 60_000)
    await updateAnimalAssigning(
      fdm,
      principal_id,
      l_id_animal,
      l_id_herd,
      originalStart,
      { l_assigning_start: correctedStart },
    )

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
      l_herd_category: "rvo_100",
    })

    await expect(
      updateAnimalAssigning(fdm, principal_id, l_id_animal, l_id_herd, correctedStart, {
        l_id_herd: otherHerdId,
      }),
    ).rejects.toThrowError("Exception for updateAnimalAssigning")
  })

  it("should hard-delete an animal_assigning record via removeAnimalAssigning", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL700000011",
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
      l_id_eartag: "NL700000001",
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
      l_id_eartag: "NL700000002",
    })
    // Hard delete entirely
    await removeAnimal(fdm, principal_id, removedAnimal)

    const census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    const herdCensus = census.find((c) => c.l_id_herd === l_id_herd)
    expect(herdCensus).toBeDefined()
    expect(herdCensus?.count).toBe(0)
  })

  it("should leave every animal when a herd leaves the farm", async () => {
    const animalIds = await addAnimalsToHerd(fdm, principal_id, l_id_herd, 3, {
      l_species: "cattle",
      l_arriving_method: "purchased",
    })
    const leavingDate = new Date(Date.now() + 60_000)

    const leftAnimalIds = await leaveHerd(
      fdm,
      principal_id,
      l_id_herd,
      leavingDate,
      "sold",
    )

    expect(leftAnimalIds.sort()).toEqual(animalIds.sort())
    expect(await getAnimalsForHerd(fdm, principal_id, l_id_herd)).toEqual([])
    for (const l_id_animal of animalIds) {
      const animal = await getAnimal(fdm, principal_id, l_id_animal)
      expect(animal.l_leaving_date?.toISOString()).toBe(leavingDate.toISOString())
      expect(animal.l_leaving_method).toBe("sold")
      expect(animal.l_id_herd).toBeNull()
    }
    const census = await getCensusForFarm(fdm, principal_id, b_id_farm)
    expect(census.find((c) => c.l_id_herd === l_id_herd)).toBeUndefined()
  })

  it("should reassign every active animal in a herd together", async () => {
    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_herd_category: "rvo_101",
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
    expect(await getAnimalsForHerd(fdm, principal_id, l_id_herd)).toEqual([])
    expect((await getAnimalsForHerd(fdm, principal_id, targetHerdId)).map((a) => a.l_id_animal).sort()).toEqual(
      animalIds.sort(),
    )
    for (const l_id_animal of animalIds) {
      const animal = await getAnimal(fdm, principal_id, l_id_animal)
      expect(animal.l_id_herd).toBe(targetHerdId)
      expect(animal.l_leaving_date).toBeNull()
    }
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
      l_herd_category: "rvo_100",
    })

    await expect(
      addAnimal(fdm, principal_id, b_id_farm, otherHerdId, {
        l_id_eartag: "NL800000001",
      }),
    ).rejects.toThrowError("Exception for addAnimal")
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
    ).rejects.toThrowError("Exception for addAnimal")
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

  it("should deny access to unauthorized principal for remaining animal functions", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL333333333",
    })
    const invalidUser = "unauthorized_user"

    await expect(
      addAnimal(fdm, invalidUser, b_id_farm, l_id_herd, { l_id_eartag: "NL444444444" }),
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
      l_herd_category: "rvo_101",
    })

    await expect(
      assignAnimalToHerd(fdm, invalidUser, l_id_animal, otherHerdId),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      reassignHerdAnimals(fdm, invalidUser, l_id_herd, otherHerdId),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      createHerdWithAnimals(fdm, invalidUser, b_id_farm, { l_herd_name: "Kudde" }, 2),
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
      l_id_eartag: "NL666666666",
      l_arriving_method: "purchased",
      l_arriving_date: arrivingDate,
    })

    const animal = await getAnimal(fdm, principal_id, l_id_animal)
    expect(animal.l_arriving_method).toBe("purchased")
    expect(animal.l_arriving_date?.toISOString()).toBe(arrivingDate.toISOString())
  })

})
