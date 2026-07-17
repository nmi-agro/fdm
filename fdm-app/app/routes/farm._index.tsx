import {
  acceptInvitation,
  declineInvitation,
  getFarms,
  listPendingInvitationsForUser,
} from "@nmi-agro/fdm-core"
import { ArrowRight, Check, House, Layers, LifeBuoy, MapIcon, Mountain, Plus } from "lucide-react"
import { useMemo } from "react"
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FarmCard, type FarmWithRoles } from "~/components/blocks/farm/farm-card"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { PendingInvitationCard } from "~/components/blocks/farm/pending-invitation"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { OrganizationCard } from "~/components/blocks/organization/organization-card"
import { PendingOrganizationInvitationCard } from "~/components/blocks/organization/pending-organization-invitation"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { SidebarInset } from "~/components/ui/sidebar"
import { auth, getSession } from "~/lib/auth.server"
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getTimeBasedGreeting } from "~/lib/greetings"
import { parseOrganizationMetadata } from "~/lib/organization-helpers"
import { AccessFormSchema } from "~/lib/schemas/access.schema"

// Meta
export const meta: MetaFunction = () => {
  return [
    { title: `Bedrijven | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beheer uw landbouwbedrijf en percelen.",
    },
  ]
}

/**
 * Retrieves the user session and associated farms data, including the user's role.
 *
 * The function obtains the user session from the incoming request and then fetches the user's farms using the session's principal ID. It maps the farm data into a simplified array containing each farm's identifier, name, and the user's role. It returns this alongside the user's name.
 *
 * @param request - The HTTP request object used to retrieve session information.
 * @returns An object containing:
 *   - farmsWithRoles: An array of objects, each with a farm's ID, name, and the user's role.
 *   - username: The user's name from the session data.
 *
 * @throws {Error} If retrieving the session or fetching the farm data fails.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the session
    const session = await getSession(request)

    // Get latest available year
    const calendar = getCalendarSelection()[0] ?? "all"

    // Get a list of possible farms of the user
    const farms = await getFarms(fdm, session.principal_id)
    const farmOptions = farms.map((farm) => {
      return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm,
      }
    })

    // Get pending farm invitations for this user
    const pendingInvitations = await listPendingInvitationsForUser(fdm, session.user.id)

    const rawOrganizations = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const organizations = await Promise.all(
      rawOrganizations.map(async (organization) => {
        const membersListResponse = await auth.api.listMembers({
          headers: request.headers,
          query: {
            organizationId: organization.id,
          },
        })

        const userRoles = membersListResponse.members
          .filter((member) => member.userId === session.principal_id)
          .map((member) => member.role)

        const orderedUserRoles = (["owner", "admin", "member"] as const).filter((r) =>
          userRoles.includes(r),
        )

        return {
          ...organization,
          userRoles: orderedUserRoles,
          metadata: parseOrganizationMetadata(organization),
        }
      }),
    )

    const pendingOrganizationInvitations = await auth.api.listUserInvitations({
      headers: request.headers,
    })

    // Return user information from loader
    return {
      farms: farms.map((farm) => {
        const allOrganizationRoles = farm.roles.filter(
          (role) => role.principal_type === "organization",
        )

        // Find the organization with the most significant role
        const roleHierarchy = ["owner", "advisor", "researcher"] as const
        allOrganizationRoles.sort(
          (role1, role2) => roleHierarchy.indexOf(role1.role) - roleHierarchy.indexOf(role2.role),
        )
        const organization = allOrganizationRoles
          .map((role) =>
            organizations.find((organization) => organization.id === role.principal_id),
          )
          .find((organization) => organization)

        // Collect the user roles
        const userRoles = [
          ...new Set(
            farm.roles.filter((role) => role.principal_type === "user").map((role) => role.role),
          ),
        ]
        // Collect the roles for the chosen most significant organization
        const organizationRoles = organization
          ? [
              ...new Set(
                farm.roles
                  .filter(
                    (role) =>
                      role.principal_type === "organization" &&
                      role.principal_id === organization.id,
                  )
                  .map((role) => role.role),
              ),
            ]
          : []
        return {
          ...farm,
          userRoles: userRoles,
          organizationRoles: organizationRoles,
          organization: organization,
        } satisfies FarmWithRoles
      }),
      farmOptions: farmOptions,
      organizations: organizations,
      calendar: calendar,
      username: session.userName,
      pendingInvitations: pendingInvitations,
      pendingOrganizationInvitations: pendingOrganizationInvitations,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, AccessFormSchema)

    if (formValues.intent === "accept_farm_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await acceptInvitation(fdm, formValues.invitation_id, session.user.id)
      return dataWithSuccess(null, {
        message: "Uitnodiging geaccepteerd",
      })
    }

    if (formValues.intent === "decline_farm_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await declineInvitation(fdm, formValues.invitation_id, session.user.id)
      return dataWithSuccess(null, {
        message: "Uitnodiging geweigerd.",
      })
    }

    if (formValues.intent === "accept_organization_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await auth.api.acceptInvitation({
        headers: request.headers,
        body: { invitationId: formValues.invitation_id },
      })
      return dataWithSuccess(null, {
        message: "Uitnodiging geaccepteerd",
      })
    }

    if (formValues.intent === "decline_organization_invitation") {
      if (!formValues.invitation_id) {
        return dataWithError(null, "Ontbrekend uitnodigings id")
      }
      await auth.api.rejectInvitation({
        headers: request.headers,
        body: { invitationId: formValues.invitation_id },
      })
      return dataWithSuccess(null, {
        message: "Uitnodiging geweigerd.",
      })
    }

    return dataWithError(null, "Onbekende actie")
  } catch (error) {
    console.error(error)
    return dataWithError(null, "Er is iets misgegaan")
  }
}

function SupportNote() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
      <LifeBuoy className="h-4 w-4" aria-hidden="true" />
      <span>
        Hulp nodig of vragen?{" "}
        <NavLink to="/support/new" className="text-primary font-medium hover:underline">
          Neem contact op
        </NavLink>
      </span>
    </div>
  )
}

/**
 * Renders the user interface for farm management.
 *
 * This component uses data from the loader to display a personalized greeting and either a list of available
 * farms for selection or a prompt to create a new farm if none exist. It integrates various UI elements like
 * the header, title, card layout, and navigation buttons to facilitate seamless interaction.
 */
export default function AppIndex() {
  const loaderData = useLoaderData<typeof loader>()
  const greeting = getTimeBasedGreeting()

  const [userFarms, organizationFarms] = useMemo(() => {
    const userFarms = loaderData.farms
      .filter((farm) => farm.userRoles.length > 0)
      .map((farm) => ({
        ...farm,
        organization: undefined,
        organizationRoles: undefined,
      }))
    const organizationFarms = loaderData.farms.filter((farm) => farm.organization)
    return [userFarms, organizationFarms]
  }, [loaderData])

  const atlasBaseFarmId = userFarms[0]?.b_id_farm ?? organizationFarms[0]?.b_id_farm ?? "undefined"

  return (
    <SidebarInset>
      <Header action={undefined}>
        <HeaderFarm b_id_farm={undefined} farmOptions={loaderData.farmOptions} />
      </Header>
      <main className="flex flex-1 flex-col">
        {loaderData.farms.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 md:p-10">
            <div className="mx-auto flex w-full max-w-212.5 flex-col items-center space-y-8 text-center">
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  Welkom bij {clientConfig.name}
                </h1>
                <p className="text-foreground/70 mx-auto max-w-162.5 text-lg sm:text-xl">
                  Richt uw eerste bedrijf in en ontdek direct uw stikstofbalans, bemestingsadvies,
                  gebruiksruimte en bodemgezondheidscores.
                </p>
              </div>

              {loaderData.pendingInvitations.length > 0 && (
                <div className="w-full space-y-4">
                  <div className="space-y-1 text-left">
                    <h2 className="text-xl font-semibold">Openstaande uitnodigingen</h2>
                    <p className="text-muted-foreground text-sm">
                      U bent uitgenodigd voor een bedrijf. Accepteer de uitnodiging om direct aan de
                      slag te gaan.
                    </p>
                  </div>
                  <div className="grid w-full gap-4 sm:grid-cols-2">
                    {loaderData.pendingInvitations.map((invitation) => (
                      <PendingInvitationCard
                        key={invitation.invitation_id}
                        invitation={invitation}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid w-full gap-6 sm:grid-cols-2">
                <Card className="group hover:border-primary bg-primary/5 relative flex flex-col overflow-hidden border-2 transition-all hover:shadow-xl">
                  <NavLink to="/farm/create" className="flex h-full flex-col">
                    <CardHeader className="pb-4">
                      <div
                        aria-hidden="true"
                        className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-left transition-colors"
                      >
                        <House className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-left text-2xl">Bedrijf aanmaken</CardTitle>
                      <CardDescription className="text-left text-base">
                        Beheer uw percelen en bereken bemestingsadviezen conform de actuele
                        gebruiksnormen.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-muted-foreground grow text-left text-sm">
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Balansen:</b> Uw bodemgezondheid zichtbaar via stikstof- en
                            organische stofbalansen.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Bemestingsadvies:</b> Adviezen afgestemd op uw bodemanalyse en
                            gewassen.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Gebruiksruimte:</b> Stikstof, dierlijke mest en fosfaat altijd
                            inzichtelijk.
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <span
                        className={buttonVariants({ size: "lg", className: "w-full" })}
                        aria-hidden="true"
                      >
                        Maak een bedrijf aan
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </span>
                    </CardFooter>
                  </NavLink>
                </Card>

                <Card className="group hover:border-primary/50 relative flex flex-col overflow-hidden border transition-all hover:shadow-md">
                  <NavLink
                    to={`/farm/${atlasBaseFarmId}/${loaderData.calendar}/atlas/fields`}
                    className="flex h-full flex-col"
                  >
                    <CardHeader className="pb-4">
                      <div
                        aria-hidden="true"
                        className="bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-left transition-colors"
                      >
                        <MapIcon className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-left text-2xl">Atlas verkennen</CardTitle>
                      <CardDescription className="text-left text-base">
                        Verken openbare kaartdata over percelen, bodem en hoogte in Nederland — geen
                        bedrijf nodig.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-muted-foreground grow text-left text-sm">
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Percelen:</b> Gewashistorie en ruimtelijke kenmerken van alle
                            percelen in Nederland.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Hoogtekaart:</b> AHN4-data voor inzicht in het microreliëf van uw
                            percelen.
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check
                            className="text-primary mt-1 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            <b>Bodemkaart:</b> Bodemtype en grondwatertrappen op perceel niveau.
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <span
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                          className: "w-full",
                        })}
                        aria-hidden="true"
                      >
                        Verken de Atlas
                      </span>
                    </CardFooter>
                  </NavLink>
                </Card>
              </div>

              <SupportNote />
            </div>
          </div>
        ) : (
          <>
            <FarmTitle
              title={`${greeting}, ${loaderData.username}`}
              description={
                "Selecteer een bedrijf voor beheer en analyses, waaronder stikstof- en organische stofbalansen voor effectieve doelsturing."
              }
              action={{
                to: "/farm/create",
                label: "Nieuw bedrijf",
              }}
            />
            <div className="grid gap-6 px-4 pb-8 md:px-8 md:pb-10 lg:grid-cols-2 xl:grid-cols-3">
              {userFarms.map((farm) => (
                <FarmCard key={farm.b_id_farm} farm={farm} />
              ))}

              <Card className="hover:border-primary/50 hover:bg-muted/50 flex flex-col border-dashed transition-all">
                <NavLink to="/farm/create" className="flex h-full flex-col">
                  <CardHeader className="grow items-center justify-center text-center">
                    <div className="bg-muted text-muted-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                      <Plus className="h-6 w-6" />
                    </div>
                    <CardTitle>Nieuw bedrijf</CardTitle>
                    <CardDescription>Voeg een extra bedrijf toe aan uw account.</CardDescription>
                  </CardHeader>
                </NavLink>
              </Card>
            </div>

            {/* Pending farm invitations */}
            {loaderData.pendingInvitations.length > 0 && (
              <>
                <FarmTitle
                  title="Openstaande uitnodigingen"
                  description="U hebt uitnodigingen ontvangen voor toegang tot de volgende bedrijven."
                />
                <div className="grid gap-4 px-4 pb-6 md:px-8 md:pb-8 lg:grid-cols-2 xl:grid-cols-3">
                  {loaderData.pendingInvitations.map((invitation) => (
                    <PendingInvitationCard key={invitation.invitation_id} invitation={invitation} />
                  ))}
                </div>
              </>
            )}

            {organizationFarms.length > 0 && (
              <>
                <FarmTitle
                  title="Bedrijven van uw organisaties"
                  description={"Selecteer een bedrijf van uw organisaties voor beheer en analyses."}
                />

                <div className="grid gap-6 px-4 pb-6 md:px-8 md:pb-8 lg:grid-cols-2 xl:grid-cols-3">
                  {organizationFarms.map((farm) => (
                    <FarmCard key={farm.b_id_farm} farm={farm} />
                  ))}
                </div>
              </>
            )}

            <FarmTitle
              title="Atlas"
              description="Toegang tot landelijke kaarten met informatie over percelen, bodem en hoogte."
            />
            <div className="px-4 pb-6 md:px-8 md:pb-8">
              <div className="divide-y overflow-hidden rounded-lg border">
                <NavLink
                  to={`/farm/${atlasBaseFarmId}/${loaderData.calendar}/atlas/fields`}
                  className="group hover:bg-muted/50 flex items-center gap-3 p-4 transition-colors"
                >
                  <div
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                  >
                    <MapIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Percelen</div>
                    <div className="text-muted-foreground text-sm">
                      Gewashistorie en ruimtelijke kenmerken van alle percelen in Nederland
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </NavLink>
                <NavLink
                  to={`/farm/${atlasBaseFarmId}/${loaderData.calendar}/atlas/elevation`}
                  className="group hover:bg-muted/50 flex items-center gap-3 p-4 transition-colors"
                >
                  <div
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                  >
                    <Mountain className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Hoogtekaart</div>
                    <div className="text-muted-foreground text-sm">
                      Actueel Hoogtebestand Nederland (AHN) voor gedetailleerde hoogte-informatie
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </NavLink>
                <NavLink
                  to={`/farm/${atlasBaseFarmId}/${loaderData.calendar}/atlas/soil`}
                  className="group hover:bg-muted/50 flex items-center gap-3 p-4 transition-colors"
                >
                  <div
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                  >
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Bodemkaart</div>
                    <div className="text-muted-foreground text-sm">
                      Landelijke bodemkaart met informatie over bodemtype en grondwatertrappen
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </NavLink>
              </div>
            </div>
            {loaderData.organizations.length > 0 ||
            loaderData.pendingOrganizationInvitations.length > 0 ? (
              <>
                <FarmTitle
                  title="Organisaties"
                  description="Werk samen met andere gebruikers op bedrijven in een gemakkelijke manier."
                  action={{
                    label: "Naar organisaties",
                    to: "/organization",
                  }}
                />
                {loaderData.organizations.length > 0 && (
                  <div className="grid gap-6 px-4 pb-6 md:px-8 md:pb-8 lg:grid-cols-2 xl:grid-cols-3">
                    {loaderData.organizations.map((organization) => (
                      <OrganizationCard key={organization.id} organization={organization} />
                    ))}

                    <Card className="hover:border-primary/50 hover:bg-muted/50 flex flex-col border-dashed transition-all">
                      <NavLink to="/organization/new" className="flex h-full flex-col">
                        <CardHeader className="grow items-center justify-center text-center">
                          <div className="bg-muted text-muted-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                            <Plus className="h-6 w-6" />
                          </div>
                          <CardTitle>Nieuwe organisatie</CardTitle>
                          <CardDescription>
                            Voeg een extra organisatie toe aan uw account.
                          </CardDescription>
                        </CardHeader>
                      </NavLink>
                    </Card>
                  </div>
                )}
                {loaderData.pendingOrganizationInvitations.length > 0 && (
                  <>
                    {loaderData.organizations.length > 0 && (
                      <FarmTitle
                        title="Openstaande uitnodigingen naar organisaties"
                        description="U hebt uitnodigingen ontvangen voor toegang tot de volgende organisaties."
                      />
                    )}
                    <div className="grid gap-6 px-4 pb-6 md:px-8 md:pb-8 lg:grid-cols-2 xl:grid-cols-3">
                      {loaderData.pendingOrganizationInvitations.map((invitation) => (
                        <PendingOrganizationInvitationCard
                          key={invitation.id}
                          invitation={invitation}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <FarmTitle
                  title="Organisaties"
                  description="Werk samen met andere gebruikers op bedrijven in een gemakkelijke manier."
                  action={{
                    label: "Naar organisaties",
                    to: "/organization",
                  }}
                />
                <div className="mx-auto mb-6 flex max-w-xs flex-col items-center justify-center space-y-6 text-center">
                  <h2 className="text-3xl font-bold tracking-tight text-balance">
                    U hebt nog geen organisatie.
                  </h2>
                  <div className="relative flex flex-col items-center">
                    <Button asChild>
                      <NavLink to="/organization/new">Maak een organisatie</NavLink>
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-center text-sm">
                    Of vraagt u een organisatie om u uit te nodigen.
                  </p>
                </div>
              </>
            )}
            <div className="p-4 md:px-6">
              <Separator />
            </div>
            <SupportNote />
          </>
        )}
      </main>
    </SidebarInset>
  )
}
