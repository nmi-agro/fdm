import { KeyIcon, PlusIcon, TrashIcon, BookOpenIcon } from "lucide-react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { clientConfig } from "~/lib/config"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { authClient } from "~/lib/auth-client"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const session = await getSession(request)
        return { firstname: session.user.firstname ?? session.user.name }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `API-sleutels - Instellingen | ${clientConfig.name}` },
        {
            name: "description",
            content: "Beheer je API-sleutels voor programmatische toegang.",
        },
    ]
}

interface ApiKey {
    id: string
    name: string | null | undefined
    start: string | null | undefined
    prefix: string | null | undefined
    enabled: boolean | null | undefined
    createdAt: Date
    updatedAt: Date
    expiresAt: Date | null | undefined
    lastRequest: Date | null | undefined
}

/**
 * Renders the API keys management page.
 *
 * Allows users to list, create, update, and revoke their personal API keys.
 * The raw key value is shown only once upon creation and never stored or displayed again.
 */
export default function UserSettingsApiKeys() {
    const { firstname } = useLoaderData<typeof loader>()
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [rawKey, setRawKey] = useState<string | null>(null)
    const [rawKeyOpen, setRawKeyOpen] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    async function loadKeys() {
        setIsLoading(true)
        try {
            const result = await authClient.apiKey.list({
                query: { sortBy: "createdAt", sortDirection: "desc" },
            })
            setKeys((result.data?.apiKeys as ApiKey[]) ?? [])
        } catch {
            toast.error("Kon API-sleutels niet laden.")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadKeys()
    }, [])

    async function handleCreate() {
        if (!newKeyName.trim()) return
        setIsCreating(true)
        try {
            const result = await authClient.apiKey.create({
                name: newKeyName.trim(),
            })
            const key = result.data?.key
            if (key) {
                setRawKey(key)
                setRawKeyOpen(true)
            }
            setCreateOpen(false)
            setNewKeyName("")
            await loadKeys()
        } catch {
            toast.error("Aanmaken van API-sleutel mislukt.")
        } finally {
            setIsCreating(false)
        }
    }

    async function handleRevoke(id: string) {
        try {
            await authClient.apiKey.delete({ keyId: id })
            toast.success("API-sleutel ingetrokken.")
            await loadKeys()
        } catch {
            toast.error("Intrekken van API-sleutel mislukt.")
        }
    }

    async function handleSaveName(id: string) {
        if (!editName.trim()) return
        setIsSaving(true)
        try {
            await authClient.apiKey.update({
                keyId: id,
                name: editName.trim(),
            })
            toast.success("Naam bijgewerkt.")
            setEditId(null)
            await loadKeys()
        } catch {
            toast.error("Bijwerken mislukt.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <FarmTitle
                title="API-sleutels"
                description={`Gebruik API-sleutels voor programmatische toegang tot ${clientConfig.name}. Behandel sleutels als wachtwoorden — deel ze nooit en sla ze veilig op.`}
            />
            <div className="space-y-6 px-4 md:px-8 pb-8">
            <div className="flex justify-end gap-2">
                {clientConfig.apiUrl && (
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                    >
                        <a
                            href={`${clientConfig.apiUrl}/docs`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <BookOpenIcon className="mr-2 h-4 w-4" />
                            API-documentatie
                        </a>
                    </Button>
                )}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Nieuwe sleutel
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>API-sleutel aanmaken</DialogTitle>
                            <DialogDescription>
                                Geef de sleutel een beschrijvende naam zodat je
                                hem later herkent.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label htmlFor="key-name">Naam</Label>
                            <Input
                                id="key-name"
                                placeholder={`Dashboard van ${firstname}`}
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreate()
                                }}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                            >
                                Annuleren
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={isCreating || !newKeyName.trim()}
                            >
                                {isCreating ? "Aanmaken…" : "Aanmaken"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Raw key reveal dialog — shown only once */}
            <Dialog open={rawKeyOpen} onOpenChange={setRawKeyOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Kopieer je API-sleutel
                        </DialogTitle>
                        <DialogDescription>
                            Deze sleutel wordt{" "}
                            <strong>slechts één keer</strong> getoond. Sla hem
                            op een veilige plek op. Na het sluiten van dit
                            venster is de sleutel niet meer op te vragen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all select-all">
                        {rawKey}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (rawKey) {
                                    navigator.clipboard.writeText(rawKey)
                                    toast.success("Gekopieerd naar klembord.")
                                }
                            }}
                        >
                            Kopiëren
                        </Button>
                        <Button onClick={() => setRawKeyOpen(false)}>
                            Sluiten
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Jouw sleutels</CardTitle>
                    <CardDescription>
                        Overzicht van al je actieve API-sleutels.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">
                            Laden…
                        </p>
                    ) : keys.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <KeyIcon className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Geen API-sleutels gevonden. Maak er een aan om
                                te beginnen.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {keys.map((k) => (
                                <li
                                    key={k.id}
                                    className="flex items-center gap-3 py-3"
                                >
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        {editId === k.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={editName}
                                                    onChange={(e) =>
                                                        setEditName(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-7 text-sm"
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter")
                                                            handleSaveName(k.id)
                                                        if (
                                                            e.key === "Escape"
                                                        ) {
                                                            setEditId(null)
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleSaveName(k.id)
                                                    }
                                                    disabled={isSaving}
                                                >
                                                    {isSaving
                                                        ? "Opslaan…"
                                                        : "Opslaan"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setEditId(null)
                                                    }
                                                >
                                                    Annuleren
                                                </Button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="text-sm font-medium hover:underline text-left truncate max-w-xs"
                                                onClick={() => {
                                                    setEditId(k.id)
                                                    setEditName(k.name ?? "")
                                                }}
                                                title="Klik om naam te bewerken"
                                            >
                                                {k.name ?? "(naamloos)"}
                                            </button>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {k.start && (
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {k.prefix
                                                        ? `${k.prefix}_`
                                                        : ""}
                                                    {k.start}…
                                                </span>
                                            )}
                                            <Badge
                                                variant={
                                                    k.enabled
                                                        ? "default"
                                                        : "secondary"
                                                }
                                                className="text-xs"
                                            >
                                                {k.enabled
                                                    ? "Actief"
                                                    : "Inactief"}
                                            </Badge>
                                            {k.expiresAt && (
                                                <span className="text-xs text-muted-foreground">
                                                    Verloopt:{" "}
                                                    {new Date(
                                                        k.expiresAt,
                                                    ).toLocaleDateString(
                                                        "nl-NL",
                                                    )}
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                Aangemaakt:{" "}
                                                {new Date(
                                                    k.createdAt,
                                                ).toLocaleDateString("nl-NL")}
                                            </span>
                                            {k.lastRequest && (
                                                <span className="text-xs text-muted-foreground">
                                                    Laatste gebruik:{" "}
                                                    {new Date(
                                                        k.lastRequest,
                                                    ).toLocaleDateString(
                                                        "nl-NL",
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0 text-destructive hover:text-destructive"
                                                title="Sleutel intrekken"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Sleutel intrekken?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    De sleutel{" "}
                                                    <strong>
                                                        {k.name ?? k.id}
                                                    </strong>{" "}
                                                    wordt permanent verwijderd.
                                                    Alle automatisering die
                                                    deze sleutel gebruikt, zal
                                                    stoppen met werken. Dit
                                                    kan niet ongedaan worden
                                                    gemaakt.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    Annuleren
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() =>
                                                        handleRevoke(k.id)
                                                    }
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Intrekken
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
            </div>
        </>
    )
}
