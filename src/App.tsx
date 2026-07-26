import { useCallback, useEffect, useRef, useState } from "react"
import {
    ArrowsLeftRight,
    ArrowCounterClockwise,
    DownloadSimple,
    ImageSquare,
    LockSimple,
    Sparkle,
    UploadSimple,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
    createPaletteSwatch,
    gruvboxitate,
    palette,
    presets,
    type Preset,
} from "@/lib/gruvboxitator"

interface LoadedImage {
    file: File
    bitmap: ImageBitmap
    url: string
    width: number
    height: number
}

type Status = "idle" | "processing" | "ready" | "error"

const SUPPORTED = "PNG, JPEG, WebP o AVIF"

const saveCanvas = (canvas: HTMLCanvasElement, filename: string) =>
    canvas.toBlob((blob) => {
        if (!blob) return
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }, "image/png")

/** Distinct, honest micro-preview per preset, telegraphing its tone. */
const presetPreview: Record<
    string,
    { gradient: string; vignette?: boolean }
> = {
    "1": {
        gradient: `linear-gradient(90deg, ${palette.bg0} 0%, ${palette.bg3} 36%, ${palette.fg2} 70%, ${palette.fg0} 100%)`,
    },
    "2": {
        gradient: `linear-gradient(90deg, ${palette.bg0} 0%, #5a504a 40%, #928374 76%, ${palette.fg1} 100%)`,
    },
    "3": {
        gradient: `linear-gradient(90deg, ${palette.bg0} 0%, ${palette.bg4} 30%, ${palette.orange} 64%, ${palette.fg0} 100%)`,
        vignette: true,
    },
    "4": {
        gradient: `linear-gradient(90deg, ${palette.bg1} 0%, ${palette.bg4} 36%, ${palette.fg2} 74%, ${palette.fg0} 100%)`,
    },
}

const PALETTE_SWATCHES: Array<{ name: string; hex: string }> = [
    { name: "bg0", hex: palette.bg0 },
    { name: "bg1", hex: palette.bg1 },
    { name: "bg2", hex: palette.bg2 },
    { name: "bg3", hex: palette.bg3 },
    { name: "bg4", hex: palette.bg4 },
    { name: "fg0", hex: palette.fg0 },
    { name: "fg1", hex: palette.fg1 },
    { name: "red", hex: palette.red },
    { name: "orange", hex: palette.orange },
    { name: "yellow", hex: palette.yellow },
    { name: "green", hex: palette.green },
    { name: "aqua", hex: palette.aqua },
    { name: "blue", hex: palette.blue },
    { name: "purple", hex: palette.purple },
]

function App() {
    const inputRef = useRef<HTMLInputElement>(null)
    const outputCanvasRef = useRef<HTMLCanvasElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const draggingRef = useRef(false)

    const [image, setImage] = useState<LoadedImage | null>(null)
    const [preset, setPreset] = useState<Preset>(presets[0])
    const [comparison, setComparison] = useState(50)
    const [saveSwatch, setSaveSwatch] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [status, setStatus] = useState<Status>("idle")
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState("")

    useEffect(
        () => () => {
            if (image) {
                image.bitmap.close()
                URL.revokeObjectURL(image.url)
            }
        },
        [image],
    )

    const loadFile = async (file?: File) => {
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setError("El archivo debe ser una imagen compatible.")
            setStatus("error")
            return
        }
        try {
            const bitmap = await createImageBitmap(file, {
                imageOrientation: "from-image",
            })
            const url = URL.createObjectURL(file)
            setImage((previous) => {
                if (previous) {
                    previous.bitmap.close()
                    URL.revokeObjectURL(previous.url)
                }
                return { file, bitmap, url, width: bitmap.width, height: bitmap.height }
            })
            setError("")
            setStatus("idle")
            setComparison(50)
        } catch {
            setError(`No se pudo leer la imagen. Prueba con ${SUPPORTED}.`)
            setStatus("error")
        }
    }

    const processImage = async () => {
        if (!image || !outputCanvasRef.current) return
        setStatus("processing")
        setProgress(4)
        setError("")
        try {
            const canvas = outputCanvasRef.current
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext("2d", { willReadFrequently: true })!
            context.drawImage(image.bitmap, 0, 0)
            const source = context.getImageData(0, 0, canvas.width, canvas.height)
            const result = await gruvboxitate(source, preset, setProgress)
            context.putImageData(result, 0, 0)
            setStatus("ready")
            setComparison(50)
        } catch (reason) {
            console.error(reason)
            setError("El procesamiento falló. Prueba con una imagen de menor resolución.")
            setStatus("error")
        }
    }

    const download = () => {
        if (!image || !outputCanvasRef.current || status !== "ready") return
        const baseName = image.file.name.replace(/\.[^.]+$/, "")
        saveCanvas(outputCanvasRef.current, `${baseName}-${preset.name}.png`)
        if (saveSwatch)
            saveCanvas(createPaletteSwatch(), `${baseName}-${preset.name}-palette.png`)
    }

    const reset = () => {
        if (image) {
            image.bitmap.close()
            URL.revokeObjectURL(image.url)
        }
        setImage(null)
        setStatus("idle")
        setProgress(0)
        setError("")
        setPreset(presets[0])
        setComparison(50)
        if (inputRef.current) inputRef.current.value = ""
    }

    const setComparisonFromClientX = useCallback((clientX: number) => {
        const stage = stageRef.current
        if (!stage) return
        const rect = stage.getBoundingClientRect()
        const pct = ((clientX - rect.left) / rect.width) * 100
        setComparison(Math.max(0, Math.min(100, Math.round(pct))))
    }, [])

    const onHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (status !== "ready") return
        draggingRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        setComparisonFromClientX(event.clientX)
    }
    const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!draggingRef.current || status !== "ready") return
        setComparisonFromClientX(event.clientX)
    }
    const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        draggingRef.current = false
        event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    const onHandleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (status !== "ready") return
        const step = event.shiftKey ? 10 : 2
        if (event.key === "ArrowLeft") {
            event.preventDefault()
            setComparison((v) => Math.max(0, v - step))
        }
        if (event.key === "ArrowRight") {
            event.preventDefault()
            setComparison((v) => Math.min(100, v + step))
        }
        if (event.key === "Home") {
            event.preventDefault()
            setComparison(0)
        }
        if (event.key === "End") {
            event.preventDefault()
            setComparison(100)
        }
    }

    return (
        <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground lg:h-[100dvh] lg:overflow-hidden">
            <div
                aria-hidden="true"
                className="gruv-aura pointer-events-none fixed inset-0 z-0"
            />
            <div
                aria-hidden="true"
                className="gruv-grain pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-soft-light"
            />

            <div className="relative z-10 flex min-h-[100dvh] flex-col lg:h-[100dvh]">
                <Header hasImage={Boolean(image)} onReset={reset} />

                <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-4 px-4 py-4 md:px-6 lg:min-h-0 lg:grid-cols-[340px_minmax(0,1fr)]">
                    {/* Control rail */}
                    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-xl bg-card/70 p-4 py-4 ring-1 ring-foreground/10 backdrop-blur-sm lg:h-full">
                        <p className="px-1 text-sm leading-relaxed text-muted-foreground">
                            Convierte tu imagen a{" "}
                            <span className="font-medium text-foreground">
                                Dark Hard
                            </span>
                            . Todo local.
                        </p>

                        {/* Estilo */}
                        <Section label="Estilo" className="mt-4">
                            <div className="grid grid-cols-2 gap-2">
                                {presets.map((option) => {
                                    const preview = presetPreview[option.id]
                                    const active = preset.id === option.id
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setPreset(option)}
                                            aria-pressed={active}
                                            className={`group/preset relative flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
                                                active
                                                    ? "border-primary/70 bg-primary/10 ring-1 ring-primary/30"
                                                    : "border-border bg-secondary/40 hover:border-foreground/20 hover:bg-secondary/70"
                                            }`}
                                        >
                                            <span className="relative h-6 w-full overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
                                                <span
                                                    className="absolute inset-0"
                                                    style={{
                                                        background: preview.gradient,
                                                    }}
                                                />
                                                {preview.vignette && (
                                                    <span
                                                        className="absolute inset-0"
                                                        style={{
                                                            background:
                                                                "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.5) 100%)",
                                                        }}
                                                    />
                                                )}
                                            </span>
                                            <span className="block text-[0.82rem] font-medium leading-none">
                                                {option.label}
                                            </span>
                                            <span className="block text-[11px] leading-tight text-muted-foreground">
                                                {option.description}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </Section>

                        <Divider />

                        {/* Paleta */}
                        <Section label="Paleta" className="mt-3">
                            <ol className="flex gap-1.5">
                                {PALETTE_SWATCHES.map((swatch) => (
                                    <li
                                        key={swatch.name}
                                        title={`${swatch.name} ${swatch.hex}`}
                                        className="group/swatch flex-1"
                                    >
                                        <span
                                            className="block h-7 w-full rounded-md ring-1 ring-inset ring-foreground/10 transition-transform duration-150 group-hover/swatch:scale-y-110"
                                            style={{ backgroundColor: swatch.hex }}
                                        />
                                    </li>
                                ))}
                            </ol>
                            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                                Gruvbox Material, Dark Hard - 14 tonos
                            </p>
                        </Section>

                        <Divider />

                        {/* Exportar */}
                        <Section label="Exportar" className="mt-3">
                            <div
                                role="checkbox"
                                aria-checked={saveSwatch}
                                aria-label="Guardar paleta"
                                tabIndex={0}
                                onClick={() => setSaveSwatch((v) => !v)}
                                onKeyDown={(event) => {
                                    if (event.key === " " || event.key === "Enter") {
                                        event.preventDefault()
                                        setSaveSwatch((v) => !v)
                                    }
                                }}
                                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-2.5 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="min-w-0">
                                    <span className="block text-[0.82rem] font-medium leading-none">
                                        Guardar paleta
                                    </span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground">
                                        PNG adicional con los 14 colores
                                    </span>
                                </span>
                                <Switch
                                    checked={saveSwatch}
                                    onCheckedChange={setSaveSwatch}
                                    aria-hidden
                                    tabIndex={-1}
                                    className="pointer-events-none"
                                />
                            </div>

                            {(status === "processing" || status === "ready") && (
                                <div className="mt-3 space-y-1.5" aria-live="polite">
                                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
                                        <span>
                                            {status === "processing"
                                                ? "Procesando"
                                                : "Listo"}
                                        </span>
                                        <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} />
                                </div>
                            )}

                            {error && (
                                <p
                                    role="alert"
                                    className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-[0.82rem] text-destructive"
                                >
                                    {error}
                                </p>
                            )}
                        </Section>

                        {/* Actions pinned to the rail bottom */}
                        <div className="mt-auto space-y-2 pt-4">
                            <Button
                                size="lg"
                                className="w-full"
                                onClick={processImage}
                                disabled={!image || status === "processing"}
                            >
                                <Sparkle size={16} weight="fill" />
                                {status === "ready" ? "Procesar de nuevo" : "Procesar imagen"}
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full"
                                onClick={download}
                                disabled={status !== "ready"}
                            >
                                <DownloadSimple size={16} />
                                Descargar PNG
                            </Button>
                        </div>
                    </Card>

                    {/* Stage */}
                    <Card className="relative min-h-[46dvh] gap-0 overflow-hidden rounded-xl bg-card p-0 ring-1 ring-foreground/10 lg:min-h-0 lg:h-full">
                        {!image ? (
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                onDragEnter={(event) => {
                                    event.preventDefault()
                                    setIsDragging(true)
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(event) => {
                                    event.preventDefault()
                                    setIsDragging(false)
                                    void loadFile(event.dataTransfer.files[0])
                                }}
                                className="gruv-checker grid size-full place-items-center p-6"
                            >
                                <span className="flex max-w-sm flex-col items-center text-center">
                                    <span
                                        className={`mb-5 grid size-14 place-items-center rounded-xl ring-1 ring-inset transition-colors duration-200 ${
                                            isDragging
                                                ? "bg-primary/15 text-primary ring-primary/30"
                                                : "bg-secondary text-muted-foreground ring-foreground/10"
                                        }`}
                                    >
                                        <UploadSimple size={26} />
                                    </span>
                                    <strong className="text-base font-medium">
                                        Suelta una imagen aquí
                                    </strong>
                                    <span className="mt-2 text-sm text-muted-foreground">
                                        o haz clic para elegir {SUPPORTED}
                                    </span>
                                    <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                                        <LockSimple size={12} />
                                        100% local
                                    </span>
                                </span>
                            </button>
                        ) : (
                            <div ref={stageRef} className="gruv-checker relative size-full">
                                <img
                                    src={image.url}
                                    alt="Imagen original"
                                    className="absolute inset-0 size-full object-contain"
                                    draggable={false}
                                />
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        clipPath: `inset(0 ${100 - comparison}% 0 0)`,
                                    }}
                                >
                                    <canvas
                                        ref={outputCanvasRef}
                                        aria-label="Imagen procesada"
                                        className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${
                                            status === "ready"
                                                ? "opacity-100"
                                                : "opacity-0"
                                        }`}
                                    />
                                </div>

                                {/* Floating corner tags + readouts, only when ready. */}
                                {status === "ready" && (
                                    <>
                                        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground/80 ring-1 ring-foreground/10 backdrop-blur-sm">
                                            Resultado
                                        </span>
                                        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground/80 ring-1 ring-foreground/10 backdrop-blur-sm">
                                            Original
                                        </span>
                                        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-foreground/10 tabular-nums backdrop-blur-sm">
                                            {image.width} × {image.height}
                                        </span>

                                        <div
                                            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-foreground/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                                            style={{ left: `${comparison}%` }}
                                        />
                                        <button
                                            type="button"
                                            role="slider"
                                            aria-label="Comparar resultado con original"
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={comparison}
                                            aria-valuetext={`${comparison}% procesado`}
                                            onPointerDown={onHandlePointerDown}
                                            onPointerMove={onHandlePointerMove}
                                            onPointerUp={onHandlePointerUp}
                                            onKeyDown={onHandleKeyDown}
                                            className="absolute top-1/2 z-30 flex size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-foreground/15 bg-background/85 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            style={{ left: `${comparison}%` }}
                                        >
                                            <ArrowsLeftRight size={16} />
                                        </button>
                                    </>
                                )}

                                {status === "idle" && (
                                    <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1.5 font-mono text-[11px] text-muted-foreground ring-1 ring-foreground/10 backdrop-blur-sm">
                                        Pulsa Procesar imagen para generar
                                    </span>
                                )}

                                {status === "processing" && (
                                    <div className="absolute inset-0 z-10 grid place-items-center bg-background/70 backdrop-blur-sm">
                                        <div className="w-56 space-y-3">
                                            <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                                            <div className="mx-auto h-3 w-28 animate-pulse rounded bg-muted" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/avif"
                            className="sr-only"
                            onChange={(event) => void loadFile(event.target.files?.[0])}
                        />
                    </Card>
                </main>
            </div>
        </div>
    )
}

function Header({
    hasImage,
    onReset,
}: {
    hasImage: boolean
    onReset: () => void
}) {
    return (
        <header className="sticky top-0 z-40 shrink-0 border-b border-border/70 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_2px_8px_-2px] shadow-primary/40">
                        <ImageSquare size={18} weight="bold" />
                    </span>
                    <div className="flex flex-col leading-none">
                        <span className="text-sm font-semibold tracking-tight">
                            Gruvboxitator
                        </span>
                        <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                            dark hard
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
                        <span className="size-1.5 rounded-full bg-primary" />
                        100% local
                    </span>
                    {hasImage && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onReset}
                            aria-label="Reiniciar"
                            title="Reiniciar"
                        >
                            <ArrowCounterClockwise size={18} />
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}

function Section({
    label,
    className,
    children,
}: {
    label: string
    className?: string
    children: React.ReactNode
}) {
    return (
        <section className={className}>
            <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {label}
            </h2>
            {children}
        </section>
    )
}

function Divider() {
    return <Separator className="mt-3" />
}

export default App