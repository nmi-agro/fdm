import { NavLink, useLocation } from "react-router"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"

export function SoilAnalysisFormSelection() {
    const location = useLocation()

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="w-auto">
                <CardHeader>
                    <CardTitle>Analyse uploaden</CardTitle>
                    <CardDescription>
                        Analyseformulier uploaden en inlezen
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between">
                    <Button asChild>
                        <NavLink to={`./upload${location.search}`}>
                            Kies
                        </NavLink>
                    </Button>
                </CardFooter>
            </Card>
            <Card className="w-auto">
                <CardHeader>
                    <CardTitle>Bodemanalyse</CardTitle>
                    <CardDescription>
                        Analyseformulier voor een standaard bodemanalyse
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between">
                    <Button asChild>
                        <NavLink to={`./standard${location.search}`}>
                            Kies
                        </NavLink>
                    </Button>
                </CardFooter>
            </Card>
            <Card className="w-auto">
                <CardHeader>
                    <CardTitle>Nmin bemonsering</CardTitle>
                    <CardDescription>
                        Analyseformulier voor een Nmin bemonstering
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between">
                    <Button asChild>
                        <NavLink to={`./nmin${location.search}`}>Kies</NavLink>
                    </Button>
                </CardFooter>
            </Card>
            <Card className="w-auto">
                <CardHeader>
                    <CardTitle>Derogatie analyse</CardTitle>
                    <CardDescription>
                        Analyseformulier met parameters benodigd voor derogatie
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between">
                    <Button asChild>
                        <NavLink to={`./derogation${location.search}`}>
                            Kies
                        </NavLink>
                    </Button>
                </CardFooter>
            </Card>
            <Card className="w-auto">
                <CardHeader>
                    <CardTitle>Overig</CardTitle>
                    <CardDescription>
                        Analyseformulier met alle bodemparameters beschikbaar
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between">
                    <Button asChild>
                        <NavLink to={`./all${location.search}`}>Kies</NavLink>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
