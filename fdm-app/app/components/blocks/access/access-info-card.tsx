import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export const AccessInfoCard = () => {
  return (
    <Card aria-labelledby="access-roles-title" aria-describedby="access-roles-description">
      <CardHeader>
        <CardTitle id="access-roles-title">Hoe werkt toegang tot een bedrijf?</CardTitle>
      </CardHeader>
      <CardContent>
        <p id="access-roles-description" className="text-muted-foreground text-sm">
          Bij het beheren van de toegang tot een bedrijf, zijn er verschillende rollen die
          toegewezen kunnen worden. Hieronder een overzicht van deze rollen en hun bevoegdheden:
        </p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-sm">
          <li>
            <b>Eigenaar:</b> Deze rol heeft volledige toegang tot het bedrijf. Eigenaren kunnen
            gebruikers uitnodigen, hun rol aanpassen en gebruikers verwijderen. Ze kunnen alle
            gegevens bekijken en bewerken.
          </li>
          <li>
            <b>Adviseur:</b> Adviseurs hebben toegang tot alle gegevens en kunnen deze bewerken. Ze
            kunnen echter geen gebruikers uitnodigen, rollen aanpassen of gebruikers verwijderen.
          </li>
          <li>
            <b>Onderzoeker:</b> Onderzoekers hebben leesrechten tot alle gegevens. Ze kunnen geen
            gegevens wijzigen en geen gebruikers beheren.
          </li>
        </ul>
        <br />
        <p className="text-muted-foreground text-sm">
          <b>Let op:</b> Een bedrijf heeft minimaal één <i>Eigenaar</i> nodig.
        </p>
      </CardContent>
    </Card>
  )
}
