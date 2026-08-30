/**
 * Ayuda, errores y documentos de la prueba.
 *
 * Reune la matriz de errores de la seccion 10 del prompt maestro en una galeria
 * navegable. No es una pantalla decorativa: es la evidencia de que TODOS los
 * fallos previstos tienen una respuesta disenada, y sirve tambien como material
 * de apoyo para quien opere la prueba con los 15 a 70 participantes.
 *
 * REGLA QUE SE VERIFICA AQUI: ningun error termina en un callejon sin salida.
 * Cada uno tiene titulo en lenguaje normal, explicacion sin jerga, y una accion.
 */

import { useState } from "react";
import { Download, FileText, LifeBuoy, TriangleAlert } from "lucide-react";
import { CATALOGO_ERRORES } from "@/datos/cliente";
import type { CodigoError } from "@/dominio/tipos";
import { AvisoDemo } from "@/componentes/comunes/avisos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Origen de cada fallo, para agrupar la galeria. */
const GRUPOS: { titulo: string; descripcion: string; codigos: CodigoError[] }[] = [
  {
    titulo: "Problemas con la camara",
    descripcion:
      "Es la causa mas comun de incidencias en una prueba con equipos que nadie controla.",
    codigos: [
      "camara-no-encontrada",
      "permiso-denegado",
      "camara-ocupada",
      "camara-desconectada",
    ],
  },
  {
    titulo: "Limitaciones del equipo",
    descripcion:
      "No son errores: son degradaciones controladas. La aplicacion sigue funcionando con menos.",
    codigos: ["hardware-lento", "iluminacion-deficiente", "sin-deteccion"],
  },
  {
    titulo: "Problemas al guardar",
    descripcion:
      "Perder el historial es molesto; perder la sesion entera es inaceptable. Nunca se cae la aplicacion por esto.",
    codigos: ["fallo-base-datos", "fallo-exportacion"],
  },
];

const DOCUMENTOS = [
  {
    archivo: "Consentimiento_Informado.pdf",
    titulo: "Consentimiento informado",
    quien: "Cada participante, antes de instalar",
    para: "Autorizacion firmada. Incluye la promesa de privacidad y el derecho a retirarse.",
  },
  {
    archivo: "Protocolo_Prueba_Usuario.pdf",
    titulo: "Protocolo de la prueba",
    quien: "Quien opera la prueba",
    para: "Guion completo: instalacion, calibracion, sesion de uso y cierre.",
  },
  {
    archivo: "Guia_Rapida_Participante.pdf",
    titulo: "Guia rapida del participante",
    quien: "Cada participante",
    para: "Una pagina, sin jerga tecnica. Es lo unico que necesita leer alguien no tecnico.",
  },
  {
    archivo: "Ficha_Incidencias.pdf",
    titulo: "Ficha de incidencias",
    quien: "Quien opera la prueba",
    para: "Registro de fallos de camara, confusiones en la interfaz y avisos molestos.",
  },
  {
    archivo: "habitusitos_export_ejemplo.csv",
    titulo: "Ejemplo de exportacion de datos",
    quien: "Quien analiza los resultados",
    para: "Formato exacto del CSV de historial, para preparar los scripts de analisis antes.",
  },
  {
    archivo: "benchmark_antes_despues.csv",
    titulo: "Ejemplo de comparacion de consumo",
    quien: "Quien redacta el capitulo de resultados",
    para: "Formato del CSV de benchmark, con metadatos de configuracion y equipo.",
  },
];

export function PantallaAyuda() {
  const [activo, setActivo] = useState<CodigoError | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ayuda y errores</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-balance">
            Todos los fallos previstos y como responde la aplicacion a cada uno.
            Ninguno deja al usuario sin salida.
          </p>
        </div>
        <AvisoDemo />
      </header>

      {GRUPOS.map((grupo) => (
        <Card key={grupo.titulo}>
          <CardHeader>
            <CardTitle>{grupo.titulo}</CardTitle>
            <CardDescription>{grupo.descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {grupo.codigos.map((codigo) => {
              const e = CATALOGO_ERRORES[codigo];
              const abierto = activo === codigo;
              return (
                <div
                  key={codigo}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    abierto ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  <p className="flex items-start gap-2 text-sm font-medium">
                    <TriangleAlert
                      className="text-estado-regular mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    {e.titulo}
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-xs text-balance">
                    {e.mensaje}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setActivo(abierto ? null : codigo)}
                    aria-pressed={abierto}
                  >
                    {e.accion}
                  </Button>
                  {abierto && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Asi se veria la accion en la aplicacion real. Aqui solo se
                      muestra el mensaje.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Documentos para la prueba con usuarios</CardTitle>
          <CardDescription>
            Listos para imprimir. Se generan con{" "}
            <code className="bg-muted rounded px-1 text-xs">
              python documentos/generar_documentos.py
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DOCUMENTOS.map((d) => (
            <div
              key={d.archivo}
              className="border-border flex flex-wrap items-start gap-3 rounded-xl border p-3"
            >
              <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{d.titulo}</p>
                <p className="text-muted-foreground text-xs">{d.para}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Lo usa: {d.quien}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={
                  <a href={`/documentos/${d.archivo}`} download>
                    <Download className="size-3.5" aria-hidden />
                    Descargar
                  </a>
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limitaciones conocidas</CardTitle>
          <CardDescription>
            Documentadas a proposito. Ocultarlas seria peor que reconocerlas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <Limitacion titulo="Iluminacion muy baja">
              La mejora automatica de contraste ayuda, pero por debajo de cierto
              nivel de luz la deteccion falla. En ese caso la aplicacion lo dice en
              vez de reportar puntajes poco fiables.
            </Limitacion>
            <Limitacion titulo="Camaras de muy baja resolucion">
              Con menos de 480p la posicion de las orejas y los hombros se vuelve
              imprecisa, y eso afecta sobre todo a las medidas de simetria.
            </Limitacion>
            <Limitacion titulo="Personas fuera de encuadre">
              Si la camara solo alcanza a ver la cara, no hay hombros ni caderas que
              medir. La sesion se pausa en lugar de inventar un puntaje.
            </Limitacion>
            <Limitacion titulo="Ropa muy holgada o fondos complejos">
              Pueden reducir la confianza de la deteccion. La aplicacion baja el peso
              de las medidas afectadas en vez de descartarlas del todo.
            </Limitacion>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="size-4" aria-hidden />
            Si algo falla durante la prueba
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1.5 text-sm">
          <p>1. Anota que estaba haciendo la persona cuando ocurrio.</p>
          <p>2. Registralo en la ficha de incidencias, aunque parezca menor.</p>
          <p>
            3. Si la aplicacion sigue abierta, pidele que continue: casi todos los
            fallos previstos permiten seguir con menos funciones.
          </p>
          <p>
            4. No intentes arreglar el equipo del participante. Registra y sigue: la
            incidencia es un dato de la investigacion, no un contratiempo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Limitacion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="border-border/60 border-b pb-2 last:border-0">
      <span className="text-foreground font-medium">{titulo}. </span>
      <span className="text-xs text-balance">{children}</span>
    </li>
  );
}
