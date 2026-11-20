import {
  checkPermission,
  createHerdWithAnimals,
  getAnimalCategoriesForFarm,
  getFarm,
  getFarms,
} from "@nmi-agro/fdm-core"
import { Info } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"

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
    const count = Number.parseInt(formText(formData, "count", "0"), 10)

    if (!l_id_category) {
      throw data("Diercategorie is verplicht.", { status: 400 })
    }
    if (isNaN(count) || count <= 0) {
      throw data("Aantal dieren moet minimaal 1 zijn.", { status: 400 })
    }

    await createHerdWithAnimals(
      fdm,
      session.principal_id,
      b_id_farm,
      {
        l_herd_name,
        l_id_category,
      },
      count,
      { l_arriving_method: "born" },
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
  const { b_id_farm, calendar, farmOptions, categories } = useLoaderData<typeof loader>()

  const defaultCategory = categories.find((c) => c.l_id_category === "rvo_100") ?? categories[0]
  const [selectedCategory, setSelectedCategory] = useState(
    defaultCategory?.l_id_category ?? "rvo_100",
  )
  const [herdName, setHerdName] = useState("Melkkoeien")
  const [count, setCount] = useState<number>(96)

  const activeCategoryObj = categories.find((c) => c.l_id_category === selectedCategory)
  const lsuFactor = activeCategoryObj?.l_lsu ?? 1.0
  const totalGve = (count * lsuFactor).toLocaleString("nl-NL", { maximumFractionDigits: 1 })

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
    <SidebarInset>
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

      {/* The side padding of FarmContent, so the card lines up with the other Melkvee pages */}
      <main className="max-w-2xl px-2 py-6 md:px-4 md:py-8 lg:px-6">
        <Card className="shadow-sm">
          {/* The form is the card's only child, so it carries the card's spacing itself */}
          <form method="post" className="flex flex-col gap-(--card-spacing)">
            <CardHeader>
              <CardTitle className="text-2xl">Melkvee toevoegen</CardTitle>
              <CardDescription className="text-sm">
                Voeg een koppel toe met een aantal dieren van één diercategorie. Daarna kun je
                beweiding vastleggen en zie je direct je weidedagen en veebezetting.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="category-select">Diercategorie *</FieldLabel>
                  <Select
                    value={selectedCategory}
                    items={categories.map((c) => ({
                      value: c.l_id_category,
                      label: `${c.l_category} (${(c.l_lsu ?? 1).toLocaleString("nl-NL")} GVE/dier)`,
                    }))}
                    onValueChange={(v) => {
                      if (v !== null) handleCategoryChange(v)
                    }}
                    name="l_id_category"
                  >
                    <SelectTrigger id="category-select">
                      <SelectValue placeholder="Kies diercategorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.l_id_category} value={c.l_id_category}>
                          {c.l_category} ({(c.l_lsu ?? 1).toLocaleString("nl-NL")} GVE/dier)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="herd-name">Naam van de koppel</FieldLabel>
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
                      value={count}
                      onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                      required
                    />
                  </Field>
                </div>
              </FieldGroup>

              <div className="bg-muted/40 text-muted-foreground space-y-2 rounded-lg border p-4 text-xs">
                <p className="flex items-start gap-1.5">
                  <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    We maken {count} dieren aan zonder oormerk. Vul ze later aan met oormerk en
                    levensnummer, of laat ze zoals ze zijn — voor beweiding en veebezetting is het
                    aantal genoeg.
                  </span>
                </p>
                <p className="text-foreground text-sm font-medium">
                  Dit levert op:{" "}
                  <span className="font-semibold tabular-nums">
                    {count} {count === 1 ? "dier" : "dieren"}
                  </span>{" "}
                  · <span className="font-semibold tabular-nums">{totalGve} GVE</span>
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t">
              <Button
                variant="outline"
                nativeButton={false}
                render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}
              >
                Annuleren
              </Button>
              <Button type="submit">Koppel aanmaken</Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </SidebarInset>
  )
}
