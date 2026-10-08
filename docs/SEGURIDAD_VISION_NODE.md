# Seguridad del vision-node

Aporte propio de Habitusitos. Código en `vision-node/vision_node/security.py`; pruebas en
`vision-node/tests/test_security.py`, `test_websocket_seguridad.py` y `test_stream_seguridad.py`.

## Dónde corre

La nube del proyecto es **Vercel** (`app/`) y **Supabase** (cuentas, roles, historial y consentimientos).
El `vision-node` **no se despliega en la nube**: se ejecuta en el equipo desde el que se abre la app, y el
navegador se conecta a `127.0.0.1`. El video de las personas no sale de ese equipo, lo que es la postura
más defendible frente a la Ley 1581 de 2012 (el video es un dato biométrico).

Supabase no puede alojar el nodo: es base de datos y autenticación, no un servidor que ejecute YOLO
sobre video continuo. Lo que sí aporta es la identidad: el nodo valida los tokens de Supabase.

## Amenazas que cubre

| Amenaza | Defensa |
|---|---|
| Otro programa o página del equipo se conecta al WebSocket y recibe la telemetría | Primer mensaje obligatorio `autenticar` con el `access_token` de Supabase. El nodo lo valida contra `/auth/v1/user` y comprueba que la cuenta sea de su organización (`VISION_ORG_ID`). Mientras tanto el cliente no figura en `clients` y no recibe difusiones. Cierre `4401` si falla. |
| Alguien ve el video | El video exige un ticket aleatorio de un solo uso y 30 s de vida, entregado solo por el WebSocket autenticado. El token nunca viaja en una URL. Sin `Access-Control-Allow-Origin: *`. Tope de 8 transmisiones simultáneas. |
| `cambiar_fuente` abría cualquier archivo o URL (SSRF / lectura local) | El cliente elige un índice de webcam detectado o un **alias** de `camera.named_sources` (config.json). Nunca manda una fuente libre. |
| Credenciales RTSP filtradas a todos los clientes | La URL real no sale del servidor: `info_fuentes` solo expone alias. |
| Páginas ajenas conectándose desde el navegador | `VISION_ALLOWED_ORIGINS` (cabecera Origin, `403` si no coincide). |
| Mensajes enormes, ráfagas, saturación | Mensaje máx. 16 KiB, 30 mensajes / 10 s por conexión, máx. 20 conexiones, 5 s para autenticarse, caché de 30 s del escaneo de cámaras. |
| Abrir el nodo a la red por descuido | El nodo **se niega a arrancar** (código 2) si `VISION_HOST` no es loopback y falta autenticación u orígenes. |

## Uso

**Desarrollo (sin Supabase).** No definas nada. El nodo escucha en `127.0.0.1`, la autenticación queda
apagada y lo avisa en el log:

```sh
cd vision-node && python -m vision_node.main
```

**Con autenticación (recomendado para la sustentación y la oficina).** Define las variables y arranca:

```sh
export VISION_SUPABASE_URL=https://<proyecto>.supabase.co
export VISION_SUPABASE_KEY=<clave publishable>      # nunca la service_role
export VISION_ORG_ID=<uuid de organizaciones.id>
export VISION_ALLOWED_ORIGINS=https://habitusutos.vercel.app,http://localhost:5173
python -m vision_node.main
```

El usuario inicia sesión en la app y esta manda su token al nodo; solo entran cuentas cuya
`usuarios.organizacion_id` sea `VISION_ORG_ID`.

## Variables de entorno

| Variable | Obligatoria | Qué es |
|---|---|---|
| `VISION_HOST` | no (`127.0.0.1`) | Interfaz donde escucha. Déjala en loopback. |
| `VISION_ALLOWED_ORIGINS` | solo si el host no es loopback | Orígenes web permitidos, separados por coma. |
| `VISION_SUPABASE_URL` | sí con autenticación | URL https del proyecto. |
| `VISION_SUPABASE_KEY` | sí con autenticación | Clave **publishable**. Nunca la `service_role`. |
| `VISION_ORG_ID` | sí con autenticación | UUID de la organización dueña del nodo. |
| `VISION_AUTH` | no | `on`/`off`. Sin definir, se activa sola si están las tres de Supabase. `off` solo vale en loopback. |

## Límites conocidos (no corregidos)

1. **Una transmisión de video ya abierta no se corta** si el token del usuario expira o se revoca; el ticket solo se valida al abrirla.
2. **Cualquier miembro de la organización puede cambiar entre las fuentes permitidas.** No se exige `rrhh_jefe` porque la cuenta compartida de oficina (acceso por código) es un `trabajador`.
3. **Sin limitación por IP** en los intentos fallidos de autenticación; solo el límite de 5 s y de conexiones totales.
4. **El navegador y el nodo deben estar en el mismo equipo.** La app en Vercel es HTTPS y el navegador bloquea conectarse a un `ws://` de otra máquina de la red (contenido mixto); solo exime a `127.0.0.1`. Un nodo en otro equipo de la oficina exigiría TLS propio.
5. **Las pruebas usan un Supabase simulado.** La validación contra el proyecto real (`/auth/v1/user` y la lectura de `usuarios`) no se ha probado de punta a punta.
