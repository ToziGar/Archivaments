# 🏆 Archivaments

CLI sin dependencias para desbloquear los logros (*achievements*) de GitHub que **sí** se pueden automatizar, dentro de un repositorio sandbox público tuyo.

Funciona contra la API REST de GitHub. No necesitas `gh`, ni `git`, ni instalar paquetes: sólo Node 20.6+.

---

## Qué desbloquea de verdad

| Logro | Automatizable | Comando | Niveles |
|---|---|---|---|
| **Quickdraw** | ✅ Sí | `quickdraw` | sin niveles |
| **YOLO** | ✅ Sí | `yolo` | sin niveles |
| **Pull Shark** | ✅ Sí | `pull-shark` | 2 / 16 / 128 / 1024 |
| **Pair Extraordinaire** | ✅ Sí* | `pair --with <usuario>` | 1 / 10 / 24 / 48 |
| **Galaxy Brain** | ❌ No | `guide` | 2 / 8 / 16 / 32 |
| **Starstruck** | ❌ No | `guide` | 16 / 128 / 512 / 4096 |
| **Public Sponsor** | ❌ No | `guide` | sin niveles |
| **Arctic Code Vault** / **Mars 2020** | ⛔ Retirados | — | — |

\* Necesita una segunda cuenta de GitHub real (tuya o de alguien que te lo permita) para el trailer `Co-authored-by`.

Los cuatro que no se automatizan no es por pereza del script: **Public Sponsor** requiere un pago real, y **Galaxy Brain** y **Starstruck** dependen de que otras personas te marquen respuestas o te den estrellas. Falsificarlos con cuentas títere es motivo de suspensión. `archivaments guide` te explica cómo conseguirlos de forma legítima.

---

## Instalación

```bash
npm run archivaments -- --help
```

No hay `npm install`: el proyecto no tiene dependencias.

Si lo quieres como comando global:

```bash
npm link
```

---

## Configuración (1 minuto)

1. Crea un **token clásico** en <https://github.com/settings/tokens/new> con el scope **`repo`**.
2. Copia la plantilla y pega el token dentro:

```bash
cp .env.example .env
```

3. Edita `.env` y sustituye el valor de `GITHUB_TOKEN`.

`.env` está en `.gitignore`, así que no se sube nunca. El token también se puede pasar por variable de entorno (`GITHUB_TOKEN` / `GH_TOKEN`) o con `--token`, y si tienes la GitHub CLI instalada y con sesión iniciada, se reutiliza `gh auth token` automáticamente.

4. Comprueba que todo está bien:

```bash
npm run doctor
```

---

## Uso

Antes de nada, mira lo que haría sin tocar tu cuenta:

```bash
node bin/archivaments.js all --with tu-otra-cuenta --dry-run
```

Y cuando lo tengas claro:

```bash
node bin/archivaments.js all --with tu-otra-cuenta
```

Eso crea el repo público `archivaments-lab` y desbloquea **Quickdraw**, **Pair Extraordinaire**, **YOLO** y **Pull Shark bronce** en un par de minutos.

### Comandos sueltos

```bash
node bin/archivaments.js quickdraw                      # abre y cierra un issue
node bin/archivaments.js yolo                           # PR mergeada sin review
node bin/archivaments.js pair --with usuario1,usuario2  # commit co-autorizado
node bin/archivaments.js pull-shark --tier plata        # 16 PRs mergeadas
node bin/archivaments.js pull-shark --count 40          # número exacto
node bin/archivaments.js status                         # progreso real
node bin/archivaments.js guide                          # los logros manuales
```

### Opciones útiles

| Opción | Para qué |
|---|---|
| `--dry-run` | Enseña cada llamada sin ejecutarla |
| `--yes` | Salta la confirmación (útil en scripts) |
| `--repo <nombre>` | Otro repositorio sandbox (por defecto `archivaments-lab`) |
| `--delay <ms>` | Espaciado entre escrituras (por defecto 1200) |
| `--merge-method` | `merge` (por defecto), `squash` o `rebase` |
| `--verbose` | Muestra cada petición a la API |

---

## Detalles que hacen que otros scripts fallen

Estos son los tres motivos por los que la mayoría de intentos caseros no desbloquean nada:

**1. Pair Extraordinaire no cuenta si el commit va directo a `main`.**
El logro es «*coauthored commits on merged pull request*». El commit co-autorizado tiene que entrar por una pull request **mergeada**. Por eso `pair` crea rama → commit → PR → merge, no un push directo.

**2. El email del co-autor tiene que ser el noreply exacto.**
El formato es `<id>+<login>@users.noreply.github.com`, donde `<id>` es el ID numérico de la cuenta. Si te lo inventas, GitHub no enlaza el commit con ninguna cuenta y el logro no suma. El CLI resuelve el ID por API antes de escribir el trailer.

**3. El merge por squash puede tirar los trailers.**
Un squash reescribe el mensaje del commit, que es justo donde vive el `Co-authored-by`. Por eso el método por defecto es `merge`.

Y dos cosas de configuración:

- **El repositorio tiene que ser público.** La actividad en repos privados no cuenta para los logros. El CLI crea el sandbox como público y aborta si detecta que es privado.
- **Tienes que activar la casilla** «Show Achievements on my profile» en <https://github.com/settings/profile>, o no verás ninguno aunque los tengas.

Los logros tardan **de unos minutos a unas horas** en aparecer en el perfil. No los desbloquees dos veces pensando que ha fallado.

---

## Límites de la API

Cada pull request son 4 escrituras (rama, commit, PR, merge). GitHub aplica un límite secundario de aproximadamente **80 peticiones que crean contenido por minuto**, así que el cliente espacia las escrituras 1,2 s por defecto y, si aun así recibe un 429, respeta el `Retry-After` y reintenta solo.

Órdenes de magnitud para `pull-shark`:

| Nivel | PRs | Tiempo aprox. |
|---|---|---|
| bronce | 2 | segundos |
| plata | 16 | ~1,5 min |
| oro | 128 | ~11 min |
| platino | 1024 | ~1,5 h |

---

## Estructura

```
bin/archivaments.js     punto de entrada
src/cli.js              parseo de argumentos y despacho
src/github.js           cliente REST (throttling, reintentos, errores claros)
src/lab.js              ciclo rama → commit → PR → merge
src/config.js           token, defaults y tabla de niveles
src/state.js            historial local de ejecuciones
src/log.js              salida en consola
src/commands/           un archivo por comando
docs/logros.md          ficha detallada de cada logro
```

---

## Aviso

Los logros de GitHub son cosméticos y no aparecen en las estadísticas de contribución. Hacerlos en un repositorio de pruebas propio es una práctica común y no viola los términos de servicio, pero **crear cuentas falsas** para estrellas, patrocinios o respuestas aceptadas sí que es motivo de suspensión. Este proyecto no hace nada de eso a propósito.

## Licencia

MIT
