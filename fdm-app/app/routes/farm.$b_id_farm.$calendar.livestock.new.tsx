import {
  checkPermission,
  createHerdWithAnimals,
  getAnimalCategoriesForFarm,
  getFarm,
  getFarms,
} from "@nmi-agro/fdm-core"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useNavigation,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AnimalCategoryCombobox } from "~/components/blocks/livestock/animal-category-combobox"
import { HerdArrivalField } from "~/components/blocks/livestock/herd-arrival-field"
import { PageContainer } from "~/components/custom/page-container"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import { herdArrivalDefaultKey } from "~/lib/grazing-dates"
import { parseAnimalCount, parseHerdArrival } from "~/lib/livestock-events.server"
import { serverNow } from "~/lib/server-now.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Melkvee toevoegen | ${clientConfig.name}` },
    {
      name: "description",
      content: "Voeg je eerste koppel toe om te starten met veestapel- en beweidingsbeheer.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)

    const [farm, farms, categories] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getAnimalCategoriesForFarm(fdm, session.principal_id, b_id_farm),
    ])

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      categories,
      defaultArrivalDay: herdArrivalDefaultKey(calendar, serverNow()),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const l_id_category = formText(formData, "l_id_category")
    const l_herd_name = formText(formData, "l_herd_name", "Melkkoeien").trim()

    if (!l_id_category) {
      throw data("Diercategorie is verplicht.", { status: 400 })
    }
    // 1 to 5000, also when a request bypasses the input's limits
    const count = parseAnimalCount(formText(formData, "count"))

    await createHerdWithAnimals(
      fdm,
      session.principal_id,
      b_id_farm,
      {
        l_herd_name,
        l_id_category,
      },
      count,
      { l_arriving_method: "born", l_arriving_date: parseHerdArrival(formData) },
    )

    return redirectWithSuccess(
      `/farm/${b_id_farm}/${calendar}/livestock`,
      `Koppel ${l_herd_name} aangemaakt met ${count} dieren.`,
    )
  } catch (error) {
    return handleActionError(error)
  }
}

export default function LivestockOnboarding() {
  const { b_id_farm, calendar, farmOptions, categories, defaultArrivalDay } =
    useLoaderData<typeof loader>()
  // Follows the chosen year until the user picks a day
  const [arrivalDay, setArrivalDay] = useKeyedState(defaultArrivalDay, (day) => day)
  // A second click while the herd is being created would create it twice
  const navigation = useNavigation()

  const defaultCategory = categories.find((c) => c.l_id_category === "rvo_100") ?? categories[0]
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory?.l_id_category ?? "")
  const hasCategories = categories.length > 0
  const [herdName, setHerdName] = useState("Melkkoeien")
  // Starts empty, so changing only the category does not create a number of animals by accident
  const [countText, setCountText] = useState("")
  const count = Number.parseInt(countText, 10)
  const hasCount = Number.isInteger(count) && count > 0

  const activeCategoryObj = categories.find((c) => c.l_id_category === selectedCategory)
  const lsuFactor = activeCategoryObj?.l_lsu ?? 1.0
  const totalGve = hasCount
    ? (count * lsuFactor).toLocaleString("nl-NL", { maximumFractionDigits: 1 })
    : "—"

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId)
    const cat = categories.find((c) => c.l_id_category === catId)
    if (cat) {
      if (cat.l_id_category === "rvo_100") setHerdName("Melkkoeien")
      else if (cat.l_id_category === "rvo_101") setHerdName("Jongvee < 1 jaar")
      else if (cat.l_id_category === "rvo_102") setHerdName("Jongvee ≥ 1 jaar")
      else setHerdName(cat.l_category.split("-")[1]?.trim() ?? "Koppel")
    }
  }

  return (
    <PageContainer className="bg-background">
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock`,
          label: "Terug naar Melkvee",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator className="hidden xl:block" />
        <BreadcrumbItem className="hidden xl:block">
          <BreadcrumbLink render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}>
            Melkvee
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Melkvee toevoegen</BreadcrumbItem>
      </Header>

      <div>
        <FarmTitle
          title="Melkvee toevoegen"
          description="Voeg een koppel toe met een aantal dieren van één diercategorie. Daarna kun je beweiding vastleggen en zie je direct je weidedagen en veebezetting."
        />

        <FarmContent>
          {/* The form on the left; on a wide screen what it creates sits next to it */}
          <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] lg:items-start">
            <Card className="shadow-sm">
              {/* The form is the card's only child, so it carries the card's spacing itself */}
              {/* A client-side submit: a native form reloads the page and shows its toast twice */}
              <Form method="post" className="flex flex-col gap-(--card-spacing)">
                <CardContent className="space-y-6">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="category-select">Diercategorie *</FieldLabel>
                      {!hasCategories ? (
                        <p className="text-muted-foreground text-sm">
                          Voor dit bedrijf zijn geen diercategorieën beschikbaar, dus er kan nog
                          geen koppel worden toegevoegd. Neem contact op met de ondersteuning.
                        </p>
                      ) : (
                        <>
                          <AnimalCategoryCombobox
                            id="category-select"
                            categories={categories}
                            value={selectedCategory}
                            onValueChange={handleCategoryChange}
                          />
                          <input type="hidden" name="l_id_category" value={selectedCategory} />
                        </>
                      )}
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="herd-name">Naam van de koppel *</FieldLabel>
                        <Input
                          id="herd-name"
                          name="l_herd_name"
                          value={herdName}
                          onChange={(e) => setHerdName(e.target.value)}
                          required
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="animal-count">Aantal dieren *</FieldLabel>
                        <Input
                          id="animal-count"
                          name="count"
                          type="number"
                          min="1"
                          max="5000"
                          placeholder="bijv. 96"
                          value={countText}
                          onChange={(e) => setCountText(e.target.value)}
                          required
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <HerdArrivalField value={arrivalDay} onChange={setArrivalDay} />
                      <input type="hidden" name="l_arriving_date" value={arrivalDay} />
                    </div>
                  </FieldGroup>
                </CardContent>

                <CardFooter className="flex justify-between border-t">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="submit"
                    disabled={!hasCategories || !selectedCategory || navigation.state !== "idle"}
                  >
                    Koppel aanmaken
                  </Button>
                </CardFooter>
              </Form>
            </Card>

            {/* What the form creates, without a container of its own; on a wide screen it lines
                up with the first field of the card */}
            <aside className="space-y-3 text-sm lg:pt-6" aria-labelledby="new-herd-result">
              <h2 id="new-herd-result" className="font-medium">
                Dit levert op
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:max-w-xs">
                <div>
                  <dt className="text-muted-foreground text-xs">Dieren</dt>
                  <dd className="font-semibold tabular-nums">
                    {hasCount ? count.toLocaleString("nl-NL") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">GVE</dt>
                  <dd className="font-semibold tabular-nums">{totalGve}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground max-w-prose">
                We maken {hasCount ? `${count} dieren` : "de dieren"} aan zonder oormerk. Vul ze
                later aan met oormerk en levensnummer, of laat ze zoals ze zijn. Voor beweiding
                invullen en veebezetting is het aantal genoeg.
              </p>
            </aside>
          </div>
        </FarmContent>
      </div>
    </PageContainer>
  )
}
