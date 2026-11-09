# Kino plugin SDK

The kit for writing and testing a [Kino](https://github.com/kinotvapp/kino-light) plugin on your computer, with Node 18
or newer and nothing to install. It runs your plugin the way the app does: inside a sandbox that holds only what Kino
provides (no `setTimeout`, `Buffer`, `process` or `fetch`; `import` is refused), and it checks your manifest with the
app's own rules.

El kit para escribir y probar un plugin de [Kino](https://github.com/kinotvapp/kino-light) en tu computador, con Node 18
o más nuevo y sin instalar nada. Corre tu plugin como lo hace la app: dentro de un sandbox que solo tiene lo que Kino
ofrece (sin `setTimeout`, `Buffer`, `process` ni `fetch`; el `import` se rechaza), y revisa tu manifiesto con las reglas
de la app.

## Use it / Úsalo

```
git clone https://github.com/kinotvapp/kino-plugin-sdk
node kino-plugin-sdk/sdk/init.mjs my-plugin --host example.com   # a plugin skeleton / el esqueleto de un plugin
cp -r kino-plugin-sdk/sdk kino-plugin-sdk/contract.json kino-plugin-sdk/kino.d.ts my-plugin/
cd my-plugin
node sdk/validate.mjs .
# edit plugin.js and kino-plugin.json for your site, then run a function of it / edítalos para tu sitio y corre una función:
node sdk/run.mjs ./plugin.js home
```

The kit is the `sdk/` folder; it reads `contract.json` from the folder next to it. Copy both into your plugin, or start
from a template that already carries them / El kit es la carpeta `sdk/` y lee `contract.json` de la carpeta que tiene al
lado. Copia las dos a tu plugin, o parte de una plantilla que ya las trae:

- [kino-plugin-archive](https://github.com/kinotvapp/kino-plugin-archive): the simplest / el más simple.
- [kino-plugin-own-server](https://github.com/kinotvapp/kino-plugin-own-server): every feature / todas las funciones.

`kino.d.ts` gives your editor the types of the global `kino` object.

## Where it differs from the app / Dónde difiere de la app

The kit cannot copy everything the app's engine does (memory and stack limits, the `/v` regex flag, `new URL` with
non-ASCII hosts...). The list, measured against the real engine, is in the documentation:
<https://kinotvapp.github.io/kino-plugins/engine-limits/#kit-differences>

El kit no puede copiar todo lo que hace el motor de la app (límites de memoria y de pila, la bandera `/v` de regex,
`new URL` con hosts no ASCII...). La lista, medida contra el motor real, está en la documentación.

## Plugins that use Nuvio scrapers / Plugins que usan scrapers de Nuvio

`kino.nuvio` (Kino 0.9.71, `apiVersion` 11, capability `nuvio` with `nuvioRepos`) needs scrapers the kit does not have, so
the kit answers it from a fixture, with the app's checks and limits (20 calls a minute, 12 scrapers per call, `timeoutMs`
2000 to 60000). Without a fixture it answers `unavailable`. / `kino.nuvio` necesita scrapers que el kit no tiene, así que
el kit lo responde desde una fixture, con las mismas revisiones y límites de la app. Sin fixture responde `unavailable`.

```
KINO_NUVIO_FIXTURE=kino-plugin-sdk/fixtures/nuvio.json node sdk/run.mjs . resolve '{"k":"movie","t":603}'
```

[`fixtures/nuvio.json`](fixtures/nuvio.json) is a sample: the repository the manifest names, the scrapers it offers and
what each answers for a title. The guide, with a complete example: <https://kinotvapp.github.io/kino-plugins/en/nuvio-plugins/>.

## Sync providers / Proveedores de sincronización

From `apiVersion` 12 (Kino 0.9.74) a plugin can be the transport of the person's sync between devices: the
`syncProvider` capability with the `syncPull`, `syncPush` and optional `syncStatus` exports, and the manifest's `sync`
block (`mode`, `pullEveryMs`, `pushDebounceMs`, `maxBlobBytes` up to 4 MiB, the required `keySecret`, `provision`).
`validate.mjs` checks that block with the app's rules and prints the consent line (always red: the plugin and its
service can read the synced data); the settings form's
`link` and `help` types and an action's `setSettings` and `link` answers are checked too. `run.mjs` does not call the
sync exports: test them with your own tests. The guide: <https://kinotvapp.github.io/kino-plugins/en/sync-providers/>.
Settings items may carry `devices` (`["phone"]` / `["tv"]`: where Kino draws them) and an action `linkOnly`
(never drawn, run only as a link's `confirm`), both apiVersion 12: `validate.mjs` checks them like the app; the kit
renders no form, so it does not filter by device. Three complete, signed providers to copy:
<https://github.com/kinotvapp/kino-plugin-sync-gram> (Sync-Gram, a Telegram bot of the person's own),
<https://github.com/kinotvapp/kino-plugin-sync-server> (Sync Servidor, a server of the person's own) and
<https://github.com/kinotvapp/kino-plugin-sync-gram-account> (Sync-Gram Cuenta, the person's own Telegram account,
apiVersion 13; not in any catalog: installed by pasting its repository address).

Desde `apiVersion` 12 (Kino 0.9.74) un plugin puede ser el transporte de la sincronización entre los aparatos de la
persona (capacidad `syncProvider`). `validate.mjs` revisa el bloque `sync` con las reglas de la app y muestra la línea de
consentimiento; `run.mjs` no llama a las funciones de sincronización: pruébalas con tus propias pruebas.
Los ajustes pueden llevar `devices` (`["phone"]` / `["tv"]`: dónde los dibuja Kino) y una acción `linkOnly` (nunca
se dibuja, solo corre como `confirm` de un `link`), los dos desde apiVersion 12: `validate.mjs` los revisa como la app.
Tres proveedores completos y firmados para copiar: <https://github.com/kinotvapp/kino-plugin-sync-gram> (Sync-Gram,
un bot de Telegram de la persona), <https://github.com/kinotvapp/kino-plugin-sync-server> (Sync Servidor, un servidor
de la persona) y <https://github.com/kinotvapp/kino-plugin-sync-gram-account> (Sync-Gram Cuenta, la propia cuenta de
Telegram de la persona, apiVersion 13; no está en ningún catálogo: se instala pegando la dirección de su repositorio).

## apiVersion 13 (Kino 0.9.74 and later) / apiVersion 13 (Kino 0.9.74 en adelante)

`apiVersion` 13 arrives in **Kino 0.9.74, together with apiVersion 12**, and
every Kino before 0.9.74 refuses both (`validate.mjs` says "needs Kino 0.9.74 or later").
The kit already checks and runs all of it with the app's rules:

- `socket`: `kino.ws` over Node's global `WebSocket`, `wss://` to a declared host on port 443 only, 4 sockets, the frame
  cap, frames as `Uint8Array` or `hex`/`base64` strings. Swap `globalThis.WebSocket` for a fake to test offline.
- `byteSource`: `validate.mjs` requires the `read` export; `run.mjs . resolve` accepts a
  `{ source: "plugin", handle, size, mime }` stream with the app's rules; `node sdk/run.mjs --size <total bytes> . read
  <handle> <offset> <length>` calls your `read` as Kino's proxy does and prints the byte count, the sha256 and the first
  bytes; `askRead(plugin, manifest, stream, offset, length)` in `sdk/kino-shim.mjs` does the same from a test. A complete
  plugin with its test: <https://kinotvapp.github.io/kino-plugins/en/bytes/#example>
- `storageLarge`: `kino.storage` with 16 MB in total, 2 MB per value, 1,000 keys.
- `catalog`: `kino.catalog` (upsert, search, get, remove, clear, count) in memory, with the app's answers and errors.
- `qrScan` and the settings `qr` type (`refreshMs` 2000 to 60000): `createKino(manifest, { qrScan })` takes a fake
  scanner; without it, or with `--device tv`, `kino.qr.scan` answers `unavailable`.
- `imageSource`: `validate.mjs` requires the `image` export; `node sdk/run.mjs --out poster.jpg . image <handle>` writes
  what your `image` answers, and `askImage(plugin, manifest, ref)` in `sdk/kino-shim.mjs` asks it the way Kino does.
- `kino.crypto.aesIge`, `aesIgeVerify`, `modPow`, `gunzip` and `convert`. They are gated on the Kino you run on, not on
  your manifest's `apiVersion` (`convert` and `aesIgeVerify` arrived after the first apiVersion 13 builds): feature-detect
  each one, `typeof kino.crypto.convert === "function"`, and keep a fallback. The kit offers what its own contract has.
- `node sdk/init.mjs my-plugin --host example.com --with byteSource,images,catalog,socket` (any of them) scaffolds an
  apiVersion 13 plugin that declares those capabilities with a working, commented example of each.
- A `password` or `text` setting may say `"sync": false` (apiVersion 13): its value stays on the device where it was
  typed (never sent to a paired device, in no backup or kit). `sync.provision` may name a device-only password, as a
  one-shot secret sent once to a new device, but never as the `keySecret`; it may never name a device-only text.
  `validate.mjs` refuses `"sync"` on any other type or as a non-boolean; below apiVersion 13 the key is ignored.
- `syncProvider` (or another standalone capability) may sit next to `socket`, `storageLarge`, `catalog` and `qrScan`
  and still need no `resolve`, `search` or `home`.
- An action's `setSettings` may fill one of the plugin's own `password` settings; `run.mjs` prints it masked.
- `sync.generateKey: true`: Kino makes the `keySecret` value itself (32 random bytes as 64 hex characters) while it is
  empty; `validate.mjs` refuses anything but a boolean.
- A `settingsStatus` answer may carry `hide: [setting keys]` (at most 32, unknown keys dropped): the form does not draw
  them while that answer is current. A `qr` setting with no text draws nothing.

The guide: <https://kinotvapp.github.io/kino-plugins/en/bytes/>, <https://kinotvapp.github.io/kino-plugins/en/catalog/>,
<https://kinotvapp.github.io/kino-plugins/en/images/>, <https://kinotvapp.github.io/kino-plugins/en/qr/>.

`apiVersion` 13 llegó en **Kino 0.9.74, junto con apiVersion 12**, y
todo Kino anterior a 0.9.74 rechaza las dos. El kit
ya revisa y corre todo con las reglas de la app: `kino.ws` (`socket`), `byteSource` (`run.mjs . resolve` acepta el
stream `{ source: "plugin" }`, `run.mjs --size <bytes> . read <handle> <offset> <length>` y `askRead` llaman tu `read`),
`storageLarge`, `kino.catalog`, `kino.qr.scan` con un lector de mentira y el ajuste `qr`, `"sync": false` en un ajuste `password` o
`text` (se queda en el aparato donde se escribió; `sync.provision` puede nombrar una contraseña así como secreto de un solo uso,
nunca como `keySecret`), `sync.generateKey` (Kino crea la clave), `setSettings` que llena una contraseña, `hide` en la
respuesta de `settingsStatus`, `syncProvider` junto a `socket`, `storageLarge`, `catalog` o `qrScan` sin `resolve` ni
`search`, `run.mjs --out <archivo> .
image <handle>` y `askImage` para `imageSource`, y las operaciones de bytes de `kino.crypto` (dependen de la versión de
Kino, no del `apiVersion` del manifiesto: revisa cada una con `typeof`). `init.mjs --with
byteSource,images,catalog,socket` arma un plugin de apiVersion 13 con un ejemplo de cada una. La guía: <https://kinotvapp.github.io/kino-plugins/bytes/>.

## apiVersion 14 (Kino 0.9.74 and later) / apiVersion 14 (Kino 0.9.74 en adelante)

`apiVersion` 14 **ships in Kino 0.9.74**, together with apiVersion 12 and
13; every Kino before 0.9.74 refuses it. It brings plugin screens and the capabilities around them. The kit already
checks and runs all of it with the app's rules:

**Building a plugin's UI / Construir la interfaz de un plugin.** For any plugin that needs its own screen,
configuration, onboarding, dashboard or panel, build it with Kino's screens UI (`screen`/`screenEvent`, Flutter-style
components, per-size values, the phone and the TV from the same tree) and keep the old settings form only for
compatibility; to stay installable on older Kinos keep your `apiVersion` and offer the screen through `enhancements`;
put the code in `src/` and bundle it to `plugin.js` with esbuild (`init.mjs --bundle`); check it with
`node sdk/validate.mjs .` and `node sdk/run.mjs . screen` (also `--device tv`). Guide and component catalogue:
<https://kinotvapp.github.io/kino-plugins/en/screens/>. / Para cualquier plugin que necesite su propia pantalla,
configuración, bienvenida, tablero o panel, constrúyela con las pantallas de Kino y deja el formulario de ajustes viejo
solo por compatibilidad; para seguir instalándose en un Kino anterior conserva tu `apiVersion` y ofrece la pantalla con
`enhancements`; pon el código en `src/` y empaquétalo en `plugin.js` con esbuild; revísalo con `validate.mjs` y
`run.mjs . screen`. Guía y catálogo: <https://kinotvapp.github.io/kino-plugins/screens/>.

- `screen`: a plugin draws its own screens (the `screen` block of `kino-plugin.json`, the `screen` and `screenEvent`
  exports). `node sdk/run.mjs . screen` prints the validated tree; `node sdk/run.mjs . screenEvent <name> [arg] ['<value
  json>'] [--trigger tap|change|submit]` runs the export and prints the validated answer (the first call of a real
  session is the reserved event `open`). The fake context is a phone at compact width with an empty state: `--device
  tv` draws the TV side, `--context '<json>'` merges over the context and `--state '<json>'` over its state. A tap or
  submit is the person's press; a `change` is not, so its `go.titleByIds` / `go.url` is dropped, as in the app.
- The player panel in screen mode: `panel` reads a result with `format: "screen"` as the app does; `panelAction` takes
  `--screen` and a field name. `playerPanelTab` (with `"panel": { "contributes": true }`) adds a tab to another plugin's
  title: `--foreign <plugin id>[:<name>]` gives the panel the app's foreign context, and `--live-channel
  <provider>:<code>[:<name>]` an En vivo channel's.
- `playerControl`: every panel answer's `player` is sifted by its origin and the capability, and `run.mjs` prints what
  is dropped and the notice Kino shows the person (`KINO_PLAYER_CONTROL_REVOKED=1`: the person switched it off).
- `schedule` and `jobs`: `node sdk/run.mjs . job [jobId] [scheduled|manual]` runs one background job as Kino does, with
  the run's caps on `kino.fetch` and `kino.storage` and the forbidden APIs refused with `not_allowed`.
- `shared`: `kino.shared`, a small store that syncs between the person's devices, simulated on two devices (`phone`,
  `tv`) kept in `.kino-shared.json`; a run uses `--device` and the two sync when it ends. So `job --device phone` then
  `screen --device tv` shows what the TV reads; `node sdk/run.mjs . shared` prints what each device holds.
- `ai`: `kino.ai.ask`, only after the person's press (or inside a job run), through a fake AI: `KINO_AI_REPLY=<text>`
  (the reply), `KINO_AI_ERROR=<code>` (`unavailable`, `rate_limited`, `too_large`, `timeout`, `refused`),
  `KINO_AI_REVOKED=1` (switched off).
- `room`: `kino.room`, an in-memory room with two simulated members, with the app's payload rules and refusals
  (`KINO_ROOM_REVOKED=1`: switched off).
- `library`: `kino.library.watched()` and `saved()`, read-only, from `KINO_LIBRARY_FIXTURE=<file.json>` (`[]` without
  one; `KINO_LIBRARY_REVOKED=1`: switched off).
- `kino.fetch` options `maxBytes` (stop reading after that many bytes) and `stopAt` (stop once the text holds a
  marker); the answer says `truncated`.
- A `toggle` or `select` setting may say `"unlockWith": "adultCode"`: Kino asks the device's 18+ code before the person
  moves it away from its default. The kit refuses, as the app does, a screen answer's `config` away from the default and
  a field bound to that setting.
- `enhancements`: a plugin keeps its own `apiVersion` and lists, under `"enhancements": { "14": { ... } }`, what only a
  newer Kino reads (`capabilities`, `screen`, `settings`, `panel`). An older Kino ignores the block. `validate.mjs` notes
  the enhancements Kino applies and reports each one it drops ("Kino ignores this enhancement and runs the plugin as its
  apiVersion N says"), so the plugin must keep working without them.
- `node sdk/init.mjs my-plugin --host example.com --bundle` scaffolds a plugin whose source is split into `src/` and
  bundled into `plugin.js` by `npm run build` (esbuild). `--with` keeps its apiVersion 13 options.

The guide: <https://kinotvapp.github.io/kino-plugins/en/screens/>,
<https://kinotvapp.github.io/kino-plugins/en/screen-components/>,
<https://kinotvapp.github.io/kino-plugins/en/screen-forms/>,
<https://kinotvapp.github.io/kino-plugins/en/screen-reference/>, <https://kinotvapp.github.io/kino-plugins/en/rooms/>,
<https://kinotvapp.github.io/kino-plugins/en/jobs-and-shared/>,
<https://kinotvapp.github.io/kino-plugins/en/enhancements/>, <https://kinotvapp.github.io/kino-plugins/en/plugin-files/>,
<https://kinotvapp.github.io/kino-plugins/en/structure/>.

`apiVersion` 14 **llega con Kino 0.9.74**, junto con apiVersion 12 y 13; todo
Kino anterior a 0.9.74 la rechaza. Trae las pantallas de plugin y las capacidades que las rodean, y el kit ya las revisa
y corre con las reglas de la app: `run.mjs . screen` imprime el árbol validado y `run.mjs . screenEvent <nombre>` corre
el evento (`--device tv` para el lado de la TV, `--state '<json>'` y `--context '<json>'` para el estado y el contexto);
el panel del reproductor en modo pantalla (`panelAction --screen`), `playerPanelTab` (`--foreign`, `--live-channel`) y
`playerControl`; `run.mjs . job [id]` corre una tarea en segundo plano con los topes de Kino; `kino.shared` en dos aparatos
simulados (`--device phone|tv`, `run.mjs . shared`); `kino.ai.ask` con una IA de mentira (`KINO_AI_REPLY`,
`KINO_AI_ERROR`, `KINO_AI_REVOKED`); `kino.room` en memoria con dos miembros simulados; `kino.library` desde
`KINO_LIBRARY_FIXTURE`; las opciones `maxBytes` y `stopAt` de `kino.fetch`; `"unlockWith": "adultCode"` en un ajuste
`toggle` o `select`; y `enhancements`: `validate.mjs` dice cuáles aplica Kino y avisa de cada una que descarta, porque el
plugin debe seguir funcionando sin ellas. `init.mjs --bundle` arma un plugin con el código en `src/` que `npm run build`
junta en `plugin.js`. La guía: <https://kinotvapp.github.io/kino-plugins/screens/>,
<https://kinotvapp.github.io/kino-plugins/screen-components/>, <https://kinotvapp.github.io/kino-plugins/screen-forms/>,
<https://kinotvapp.github.io/kino-plugins/screen-reference/>, <https://kinotvapp.github.io/kino-plugins/rooms/>,
<https://kinotvapp.github.io/kino-plugins/jobs-and-shared/>, <https://kinotvapp.github.io/kino-plugins/enhancements/>,
<https://kinotvapp.github.io/kino-plugins/plugin-files/>, <https://kinotvapp.github.io/kino-plugins/structure/>.

## apiVersion 15 (Kino 0.9.77) / apiVersion 15 (Kino 0.9.77)

`apiVersion` 15 arrives in **Kino 0.9.77**; every Kino before it refuses it. It brings
three capabilities, the library's episodes and a new kind of plugin, a store. The kit already checks and runs all of it with
the app's rules:

- `identity` (declarative, never alone): `kino.identity.telegram({ challenge? })` answers a pseudonym of the person for your
  plugin (`id`) and the signed token that proves it (`token`); with a `challenge` it also answers a device signature
  (`deviceKey`, `signature`, `author`, `codeHash`). **Only plugins signed with Kino's own author key get an answer**; any other
  plugin is refused with `permission_denied`. Allowed only inside a call the person started (a screen, a screen event, a panel
  action). The kit answers a fake account: `KINO_IDENTITY_TG=<id|none>`, `KINO_IDENTITY_TOKEN`, `KINO_IDENTITY_AUTHOR`,
  `KINO_IDENTITY_REVOKED=1`. Never log or show the token.
- `notifications` (declarative, never alone): `kino.notifications.post({ id, title, titleEn?, text?, textEn?, go? })` and
  `clear(id?)` leave short notices in the Home bell (80-character titles, 160-character texts, 20 posts an hour, 30 kept, 30
  days; `go` opens your own screen, `go.screen`). From a screen, a screen event or your scheduled job. The kit keeps what you
  post in `<folder>/.kino-notices.json`: `node sdk/run.mjs <folder> notifications` (`KINO_NOTIFICATIONS_REVOKED=1`: switched off).
- `library` episodes: `kino.library.watched()` carries `season` and `episode` (the latest watched) on series, never on movies.
- `pluginStore`: your plugin becomes a **source of plugins** for Kino's store. `storeSync({ reason, since, state })` answers
  `{ full, entries, removed?, state? }` (the whole list, or a change); a **live** store (`"pluginStore": { "mode": "live" }`)
  also answers `storeList({ category, sort, cursor })` and `storeSearch({ q, category, cursor })` while the person browses.
  Kino keeps one local index of every store, paints the store from it, applies the owner's blocklist and the 18+ code, and
  installs through its own consent sheet: a store only hands over addresses. The store view has three tabs, "From Kino"
  (Kino Plugins' default list), "Community" (everything else from every store; sort, store filter and live stores live
  here) and "Installed". There is one plugin per id across all stores: when two repos claim an id, the one in Kino Plugins'
  list wins, otherwise one is kept deterministically, and no store may list the id `kino-plugins`. Be ready for `since` to
  be absent at any time: when Kino loses a store's rows it syncs that store from scratch, with no `since` and no `state`,
  and the store must answer its full list. The owner's blocklist is refreshed with every store sync. `node sdk/run.mjs <folder> storeSync [--since n]
  [--state '<json>']`, `storeList [popular|recent] [category]` and `storeSearch "q"` print the answers as Kino's index would
  keep them and say what Kino drops. `node sdk/init.mjs my-store --host store.example.org --store local|live` scaffolds a store.
  Two complete examples (a static JSON list and a store with its own API) are in the guide:
  <https://kinotvapp.github.io/kino-plugins/en/store-examples/>. Authors are responsible for the plugins they list; Kino only
  lists them.

The guide: <https://kinotvapp.github.io/kino-plugins/en/plugin-stores/>,
<https://kinotvapp.github.io/kino-plugins/en/identity/>, <https://kinotvapp.github.io/kino-plugins/en/notifications/>.

`apiVersion` 15 **llega con Kino 0.9.77**; todo Kino anterior la rechaza. Trae tres
capacidades, los episodios de la biblioteca y un nuevo tipo de plugin, la tienda. El kit ya las revisa y corre con las reglas
de la app: `identity` (`kino.identity.telegram`: un seudónimo de la persona para tu plugin y el token firmado que lo prueba;
solo responde a plugins firmados con la llave de autor de Kino; el kit simula una cuenta con `KINO_IDENTITY_TG`,
`KINO_IDENTITY_TOKEN`, `KINO_IDENTITY_AUTHOR` y `KINO_IDENTITY_REVOKED`), `notifications` (`kino.notifications.post` y
`clear`: avisos en la campanita de Inicio; `run.mjs <carpeta> notifications` muestra lo publicado), los episodios de
`kino.library.watched()` (`season` y `episode` en las series) y `pluginStore` (tu plugin es una fuente de plugins para la tienda
de Kino: `storeSync`, y `storeList` y `storeSearch` si la tienda es en vivo; `run.mjs <carpeta> storeSync|storeList|storeSearch`;
`init.mjs mi-tienda --store local|live` arma una tienda). Quien escribe un plugin es responsable de él; Kino solo lo lista.
La vista de la tienda tiene tres pestañas, «De Kino» (la lista por defecto de Kino Plugins), «De la comunidad» (todo lo demás
de todas las tiendas, con el orden, el filtro de tiendas y las tiendas en vivo) e «Instalados». Hay un plugin por `id` en todas
las tiendas: si dos repositorios reclaman un `id`, gana el de la lista de Kino Plugins y, si no, se conserva uno de forma
determinista; ninguna tienda puede listar el `id` `kino-plugins`. Prepárate para que `since` falte en cualquier momento: si Kino
pierde las filas de una tienda, la sincroniza desde cero, sin `since` ni `state`, y la tienda responde su lista completa. La lista
de bloqueo del dueño se refresca con cada sincronización de tiendas.
La guía: <https://kinotvapp.github.io/kino-plugins/plugin-stores/>, <https://kinotvapp.github.io/kino-plugins/identity/>,
<https://kinotvapp.github.io/kino-plugins/notifications/>.

## apiVersion 16 and 17 (Kino 0.9.78 and the next Kino) / apiVersion 16 y 17 (Kino 0.9.78 y la próxima versión)

- **apiVersion 16, `coins`:** `kino.coins.balance()` and `kino.coins.give({ to, postId })`. The kit answers a pretend balance with the app's
  gates (`KINO_COINS_*`, `coinsRevoked`); `give` only from a screen, `screenEvent` or `panelAction`.
  / `kino.coins.balance()` y `kino.coins.give(...)`: el kit responde un saldo de mentira con las mismas reglas de la app.
- **`kino.sync.active()` and `kino.sync.setActive(on)` (Kino 0.9.78, not an apiVersion):** for a `syncProvider` plugin; the kit logs what Kino would ask.
- **apiVersion 17 (arrives with the next Kino, no number yet):** `kino.library.stats({ month })` (a month's aggregates; the fixture's `stats`),
  jobs with `"perProfile": true` (`kino.jobOn`, the `enableJob` answer, `jobsOn` in `createKino`), `kino.tmdb` in jobs, AI runs of 60 s and 20 requests,
  the `pages` widget and the `hero` text style, the `share` answer, `go.search` with `"scope": "all"` and `go: { syncProvider: true }`.
  Every rule is in [the docs](https://kinotvapp.github.io/kino-plugins/en/changelog/).
  / apiVersion 17 (con la próxima versión de Kino, aún sin número): `kino.library.stats`, trabajos `perProfile`, `kino.tmdb` en trabajos, ejecuciones de IA de 60 s y 20 peticiones,
  el widget `pages`, el estilo `hero`, la respuesta `share`, `go.search` con `scope: "all"` y `go: { syncProvider: true }`.

## apiVersion 18 to 20 (Kino 0.9.81) / apiVersion 18 a 20 (Kino 0.9.81)

These numbers carry API of **Kino 0.9.81**; every Kino before it refuses them.

- **apiVersion 18 and 19:** app themes (`appThemes`) and the `lyrics` capability, with an audio item's `ids` (`isrc`, `musicbrainz`, `youtube`).
- **apiVersion 19, screen additions:** `go: { installPlugin: { repo } }` (Kino's install sheet over your own screen), the manifest's
  `"recommends"` and the `installed` argument of `screen` and `screenEvent`, `Scaffold.onBack`, `AppBar.mergeWithKinoBar`, and text fields that
  hide the keyboard on submit. `enhancements` may now carry `visualBrowser`.
- **apiVersion 20, `kino.visualBrowser`:** the manifest key `"visualBrowser": true` and `kino.visualBrowser.available()` / `.open({ url, title,
  doneWhen, collect, userAgent, timeoutMs })`: a web window the person sees and drives (Android phone and tablet; experimental on TV), on the
  plugin's own `hosts`, to sign in or finish a step. Kino asks in its own sheet at every open; `collect` can return the cookies, the page's
  HTML or the final address, or store them straight into a secret setting (`storeAs`, which can `spill` a longer text over up to 3 more password settings). The window's own `timeoutMs` is its only time bound. `run.mjs` and `validate.mjs` check it like the app.
- **apiVersion 20, the plugin protocol:** a provider plugin opens named doors (`"provides"`) and a consumer uses them through Kino
  (`"consumes"` and `kino.plugins.call(alias, call, argument)`); no plugin ever calls another directly. Types are a small closed language
  (`string`, `number`, `boolean`, `T?`, `T[]`, named and inline objects); a request is checked strictly and a response loosely, and the errors
  are `provider_missing`, `not_declared`, `bad_input`, `bad_output`, `rate_limited`, `timeout` and `provider_failed`. A plugin whose only
  purpose is to provide (apiVersion 20, a non-empty `"provides"`, no capabilities, no settings) is **provides-only** and may leave `"hosts"`
  empty. That is derived from the manifest: there is no `providesOnly` field (`validate.mjs` warns if you write one). So may a **screen-only
  consumer** (apiVersion 20, a non-empty `"consumes"`, `capabilities` exactly `["screen"]`): `"hosts": []`; with no host its own `kino.fetch`
  is refused (unless it declares `fetchHosts: "any"` or a `url` setting) and pictures from public https addresses need no declaration.
  Kino's card says it connects to nothing only when it also has no settings. A consumer's arguments
  reach the provider, which may send them to its own hosts: never pass what you would not hand to the provider's author. `validate.mjs` checks
  both blocks like the app (also inside `enhancements["20"]`), fails a declared call or stream without its `proto_<door>_<name>` export, and
  warns about a consumed repo missing from `"recommends"` and an `everySeconds` outside 30..86400.
- **Start from a scaffold:** `node sdk/init.mjs my-provider --kind provider` (provides-only, one door with a call and a stream, its own test)
  or `node sdk/init.mjs my-consumer --kind consumer --repo owner/provider-repo --door <door> --call <call>` (writes `"hosts": []`;
  add `--host <a host the screen really fetches from>` only if it fetches one) (a screen with the install gate, one compact bar, a detail route, the error codes and a stream switch, tested against `test/provider`: a
  **stand-in** that opens the same door, call and stream names; replace it with a copy of the real provider, see its README). `--door`,
  `--call` and `--stream` (default `quotes`, `byId`, `latest`) take the real door's names, for a provider too. `node sdk/init.mjs --help`
  lists the options. Copy `sdk/` (without `sdk/test/`) and `contract.json` (required) next to the plugin; `kino.d.ts` is optional (editor typings).
- **Placeholder hosts:** `validate.mjs` warns (`!`, still accepted) on a `hosts` entry such as `example.com`, `*.example.com`, `example.org`
  or anything under `.test`, `.invalid` or `.example`; for a screen-only consumer the warning says to declare none (`"hosts": []`), see
  [a consumer's hosts](https://kinotvapp.github.io/kino-plugins/en/protocol/#text-only-consumer).
- **`run.mjs --provider <folder>`** (repeatable): the consumer's `kino.plugins.call` is answered by the plugin in that folder, in its own sandbox;
  without `--provider` a call rejects with `provider_missing`. A small provider and consumer to try it are in `fixtures/protocol/`:
  `node sdk/run.mjs --context '{"installed":{"kinotvapp/kino-plugin-tmdb":true}}' --provider fixtures/protocol/provider fixtures/protocol/consumer screen`
  (it prints no "dropped" line; add `--lang en` for the English texts) and
  `node sdk/run.mjs --context '{"installed":{"kinotvapp/kino-plugin-tmdb":true}}' --provider fixtures/protocol/provider fixtures/protocol/consumer screenEvent play`.
  `screenEvent protocol <alias>.<stream>` polls a stream once (`--cursor '<json>'` polls from a given cursor).
- **A provider on its own:** `node sdk/run.mjs <provider folder> proto <door>.<call> '<argument json>'` and
  `node sdk/run.mjs <provider folder> proto <door>.<stream> ['<cursor json>']`, with the app's checks and error codes (exit 0 with the checked
  answer, 1 with `✗ <code>: <message>`, 2 for a bad command).
  The rules: [The plugin protocol](https://kinotvapp.github.io/kino-plugins/en/protocol/) (Spanish:
  [El protocolo entre plugins](https://kinotvapp.github.io/kino-plugins/protocol/)).

Estos números traen API de **Kino 0.9.81, que aún no se publica**; todo Kino anterior los rechaza.

- **apiVersion 18 y 19:** temas de la app (`appThemes`) y la capability `lyrics`, con los `ids` de un ítem de audio (`isrc`, `musicbrainz`, `youtube`).
- **apiVersion 19, pantallas:** `go: { installPlugin: { repo } }` (la hoja de instalación de Kino sobre tu propia pantalla), `"recommends"` en el manifest
  y el argumento `installed` de `screen` y `screenEvent`, `Scaffold.onBack`, `AppBar.mergeWithKinoBar` y campos de texto que esconden el teclado al enviar.
  `enhancements` ahora puede llevar `visualBrowser`.
- **apiVersion 20, `kino.visualBrowser`:** la clave `"visualBrowser": true` del manifest y `kino.visualBrowser.available()` / `.open({ url, title,
  doneWhen, collect, userAgent, timeoutMs })`: una ventana web que la persona ve y maneja (teléfono y tableta Android; experimental en TV), sobre los
  `hosts` del plugin, para iniciar sesión o terminar un paso. Kino pregunta en su propia hoja en cada apertura; `collect` puede devolver las cookies, el HTML
  o la dirección final, o guardarlas directo en un ajuste secreto (`storeAs`, que puede repartir con `spill` un texto más largo en hasta 3 ajustes password más). El `timeoutMs` de la ventana es su único límite de tiempo. `run.mjs` y `validate.mjs` lo revisan como la app.
- **apiVersion 20, el protocolo entre plugins:** un plugin proveedor abre puertas con nombre (`"provides"`) y uno consumidor las usa a través de Kino
  (`"consumes"` y `kino.plugins.call(alias, llamada, argumento)`); ningún plugin llama a otro directamente. Un plugin que solo provee (apiVersion 20,
  `"provides"` no vacío, sin capabilities ni settings) puede dejar `"hosts"` vacío; eso se deduce del manifest: no existe un campo `providesOnly`.
  También un **consumidor solo de pantalla** (apiVersion 20, `"consumes"` no vacío, `capabilities` exactamente `["screen"]`): `"hosts": []`; sin host
  su propio `kino.fetch` se rechaza (salvo con `fetchHosts: "any"` o un ajuste `url`) y las imágenes de direcciones https públicas no se declaran.
  Los argumentos del consumidor llegan al proveedor, que puede enviarlos a sus propios hosts: no pases lo que no le darías a quien lo escribió.
  `validate.mjs` revisa los dos bloques como la app, falla si falta la exportación `proto_<puerta>_<nombre>` de una llamada o flujo declarado y avisa
  si el repo consumido no está en `"recommends"`.
- **Empieza con una plantilla:** `node sdk/init.mjs mi-proveedor --kind provider` o
  `node sdk/init.mjs mi-consumidor --kind consumer --repo dueño/repo-del-proveedor --door <puerta> --call <llamada>` (escribe `"hosts": []`;
  `--host <un host del que la pantalla de verdad descarga>` solo si descarga de uno).
  `test/provider` es un proveedor **de reemplazo**: cámbialo por una copia del proveedor real (lee su README). `validate.mjs` avisa (`!`, sin rechazar)
  si un host es de relleno (`example.com`, `*.example.com`, `example.org`, `.test`, `.invalid`, `.example`); a un consumidor solo de pantalla le dice que
  no declare ninguno (`"hosts": []`), lee [los hosts de un consumidor](https://kinotvapp.github.io/kino-plugins/protocol/#text-only-consumer).
- **`run.mjs --provider <carpeta>`** (repetible): el `kino.plugins.call` del consumidor lo responde el plugin de esa carpeta, en su propio sandbox; sin
  `--provider` la llamada se rechaza con `provider_missing`. En `fixtures/protocol/` hay un proveedor y un consumidor pequeños para probarlo.
  Un proveedor solo: `node sdk/run.mjs <carpeta> proto <puerta>.<llamada> '<json>'` (un flujo: `proto <puerta>.<flujo> ['<cursor>']`).
  Las reglas: [El protocolo entre plugins](https://kinotvapp.github.io/kino-plugins/protocol/).

## apiVersion 21 (Kino 0.9.82) / apiVersion 21 (Kino 0.9.82)

- **apiVersion 21, `files`:** the capability for a plugin that works with files on the person's device (a reader, a music or video player).
  `kino.files.pick({ kinds?, multiple?, copy? })` and `pickFolder({ kinds? })` open Kino's picker and answer opaque handles, never an address;
  `list`, `folders`, `info`, `read(id, { start?, end? })`, `readText`, `forget` and `url(id)` (`kino-file:<id>`, which a stream's or an audio
  track's `url` may carry) work with them. `pick` and `pickFolder` run only from a press (a settings action, a `panelAction` or a `screenEvent`
  that follows a tap or submit). The kit answers from the folder named by `KINO_FILES_DIR` (default `./.kino-files`), with the app's limits and
  error codes. Nothing is uploaded or sent anywhere. Every rule is in the guide, "Files on the device".
  / `files`: archivos del aparato de la persona. `kino.files.pick` y `pickFolder` abren el selector de Kino y devuelven manijas opacas;
  `read` lee por rangos y `url(id)` da una dirección `kino-file:` para reproducir. El kit responde desde la carpeta `KINO_FILES_DIR`.
- **Screens, additive (no new apiVersion; an older Kino ignores them):** `onSwipeLeft` / `onSwipeRight` on any node, an `Image` `url` that is a
  `data:image/png|jpeg|webp|gif;base64,…` (up to 200,000 characters), `divider: false` on `AppBar` and `TabBar`, and `logo` and `h` on `heroCard`.
  / Pantallas, sin apiVersion nuevo: deslizar a los lados, imágenes `data:`, `divider: false` y `logo`/`h` en `heroCard`.
- **App themes, additive:** `colors.border` and the borders `shape.dialogBorder`, `menuBorder`, `headerBorder`, `cardBorder` and `panelBorder`
  (0 to 4 dp; Kino has none until a theme asks), and a light background is accepted when the theme brings its own readable text.
  / Temas: `colors.border` y los bordes `shape.*Border`; un fondo claro se acepta si el tema trae su propio texto legible.

## apiVersion 22 (the next Kino) / apiVersion 22 (la próxima versión de Kino)

- **apiVersion 22, `progress`:** the capability for a plugin that keeps where the person is in something that is not a video (a chapter, a
  book, an episode of audio). `kino.progress.set({ id, fraction, title?, label?, labelEn?, poster?, resume?, done?, doneAt? })`, `get(id)`,
  `clear(id)` and `list({ limit?, sinceMs? })`. Kino draws nothing from it: you build your own "keep reading" shelf from `list`, and `resume`
  is your own JSON (up to 1 KB) that comes back as you set it. It needs no approval line and no extra host. The kit keeps the elements in memory
  for the run, with the app's argument rules, limits (500 elements, 80-character labels) and error codes. Every rule is in the guide,
  "Saving where the person is".
  / `progress`: guarda en qué punto va la persona en algo que no es video (un capítulo, un libro). `kino.progress.set`, `get`, `clear` y `list`;
  Kino no dibuja nada con ello: tú armas tu propio estante con `list`, y `resume` es tu JSON (hasta 1 KB). El kit lo guarda en memoria durante la corrida.
- **Screens, additive (Kino 0.9.83; an older Kino ignores it):** an `Image` takes `headers: { Referer?, User-Agent? }`, for a site that serves
  its pictures only to requests that carry its own page. They are sent only when the picture's host is in your manifest's `hosts`; the kit
  reads and validates them like the app does. See "Pictures that need a Referer" in the user interface reference.
  / Pantallas, sin apiVersion nuevo: una `Image` acepta `headers` (`Referer` y `User-Agent`) para sitios que solo sirven sus imágenes a quien trae su página; solo se envían a hosts de tu manifest.

## apiVersion 23 (the next Kino, provisionally 0.9.83) / apiVersion 23 (la próxima versión de Kino, provisionalmente la 0.9.83)

- **apiVersion 23, `playerSlot`:** up to three small elements (a `text`, an `icon`, an `image` or a `button`) in the top-right corner of the
  TV player, declared in the manifest's `slot` block (1 to 3 `{ id, kind, mode }`, `mode` `overlay` with the controls or `fixed` all the time)
  and filled by your `playerSlot(context)` export (`{ items, refreshMs }`, 2,000 to 60,000 ms); a press calls `playerSlotAction({ id, context })`
  (`{ openPanel?, player? }`). A `fixed` element shows a red approval line. The kit's `sdk/slot.mjs` reads a frame and a press the way the app
  does: `node sdk/run.mjs <folder> playerSlot [ref]`, `node sdk/run.mjs <folder> playerSlotAction <ref> <button id>`, with `--bare`,
  `--foreign` and `--live-channel` for the other contexts; `validate.mjs` checks the block and both exports. A complete clock is on the
  guide's "The player slot" page.
  / `playerSlot`: hasta tres elementos pequeños en la esquina superior derecha del reproductor de la TV, declarados en el bloque `slot` del
  manifiesto y llenados por `playerSlot(context)`; un toque llama a `playerSlotAction`. Un elemento `fixed` pide aprobación en rojo. El kit
  los prueba con `run.mjs playerSlot` y `run.mjs playerSlotAction`.
- **The look of a slot text and where it sits (no new apiVersion):** a `text` item may carry `size` (`small`, `normal`, `large`, `xlarge`),
  `weight` (`extralight`, `light`, `normal`, `medium`, `semibold`, `bold`), `color` and `background` (`#RRGGBB` or `#RRGGBBAA`; a
  `background` with alpha 0 draws no pill), and any item may carry `left` and `top` (whole dp, clamped, to nudge it). Each invalid field is
  ignored on its own, the letters never get less than half opacity, and a `color` that cannot be read on its opaque pill is dropped.
  The kit's `sdk/slot.mjs` applies the same rules. A plugin offers them as ordinary settings, as the clock example does (a time zone as a
  fixed UTC offset that does not follow daylight saving time, size, weight, colour, background and position).
  / Un `text` puede traer `size`, `weight`, `color` y `background`, y cualquier elemento `left` y `top` (dp enteros, acotados) para
  moverlo; Kino ignora cada campo inválido y mantiene el texto legible. El reloj de ejemplo los ofrece como ajustes, con la zona horaria
  como un desfase fijo respecto de UTC (no sigue el horario de verano).

## Tests

```
node --test sdk/test/*.test.mjs
```

Some tests read files of the app's repository, which this one does not carry; they are skipped here with the reason. The apiVersion 20 protocol tests run here too, against `fixtures/protocol/`. The apiVersion 15 tests (identity, notifications, stores, `init --store`) run here.
Among them are the tests that run the guide's apiVersion 13 examples (catalog, images, QR, encoded frames) and the
catalog's shared test vectors: they run in the app's repository. So do the check of the `--bundle` scaffold against the
guide's bundled example and the user interface reference's tests, which read only that page and its example plugins
and are not copied here.

## Licence / Licencia

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

The kit is developed together with the app and this repository is a copy of it for plugin authors. / El kit se
desarrolla junto con la app y este repositorio es una copia para quien escribe plugins.
