# Ficha de cada logro

Referencia rapida de requisitos exactos, niveles y trampas conocidas.

---

## Quickdraw

**Requisito:** cerrar un issue o una pull request en menos de 5 minutos desde su creacion.
**Niveles:** ninguno, se tiene o no se tiene.

Cuenta el issue **que tu abres** y cierras. El CLI espera 4 segundos antes de
cerrar para que quede un evento realista; el margen es de 5 minutos, asi que
sobra tiempo de sobra incluso con la API lenta.

---

## YOLO

**Requisito:** mergear una pull request sin ninguna review aprobatoria.
**Niveles:** ninguno.

En un repositorio recien creado no hay reglas de proteccion de rama, asi que
cualquier merge propio cuenta. Si tu repo sandbox tiene proteccion activada,
el merge fallara con un 405; quita la regla o usa `--repo` con otro nombre.

---

## Pull Shark

**Requisito:** pull requests abiertas por ti que acaben mergeadas.
**Niveles:** 2 (bronce) / 16 (plata) / 128 (oro) / 1024 (platino).

Cuenta la PR mergeada, no el numero de commits. Las PRs en tus propios repos
publicos cuentan igual que las de proyectos ajenos.

---

## Pair Extraordinaire

**Requisito:** commits co-autorizados en una pull request **mergeada**.
**Niveles:** 1 (bronce) / 10 (plata) / 24 (oro) / 48 (platino).

Las tres condiciones que hay que cumplir a la vez:

1. El commit lleva un trailer `Co-authored-by:` al final del mensaje,
   separado del cuerpo por una linea en blanco.
2. El email es el noreply real del co-autor:
   `<id>+<login>@users.noreply.github.com`. El `<id>` es el numerico de la
   cuenta, que se obtiene de `https://api.github.com/users/<login>`.
3. El commit entra en `main` **a traves de una PR mergeada**. Un push directo
   no cuenta.

Ojo con el squash merge: reescribe el mensaje y puede perder los trailers.

Formato exacto del mensaje:

```
Añade nueva funcionalidad

Co-authored-by: Nombre Apellido <12345+usuario@users.noreply.github.com>
```

---

## Galaxy Brain

**Requisito:** respuestas tuyas marcadas como aceptadas en Discussions.
**Niveles:** 2 (bronce) / 8 (plata) / 16 (oro) / 32 (platino).

Sólo el autor de la discusion (o un mantenedor) puede marcar la respuesta.
En tus propias discusiones te la puedes marcar tu, pero GitHub ha filtrado
casos de auto-aceptacion en repos sin actividad. La via fiable es responder
en proyectos que uses de verdad.

---

## Starstruck

**Requisito:** un repositorio tuyo alcanza cierto numero de estrellas.
**Niveles:** 16 (bronce) / 128 (plata) / 512 (oro) / 4096 (platino).

Las estrellas tienen que venir de cuentas reales y distintas. Comprarlas o
usar cuentas creadas para esto es motivo de suspension de la cuenta.

---

## Public Sponsor

**Requisito:** patrocinar a alguien via GitHub Sponsors con el patrocinio
marcado como publico.
**Niveles:** ninguno.

Hay perfiles con niveles desde 1 $/mes. Se desbloquea al procesarse el pago.
Requiere un metodo de pago real; ninguna automatizacion deberia hacerlo por ti.

---

## Retirados

- **Arctic Code Vault Contributor:** codigo publico incluido en el snapshot del
  2 de febrero de 2020, conservado en Svalbard. Cerrado desde entonces.
- **Mars 2020 Contributor:** contribuciones a dependencias usadas en el
  helicoptero Ingenuity de la NASA. Cerrado.

Ninguno de los dos se puede conseguir ya.

---

## Requisitos comunes

- **Repositorio publico.** La actividad en privado no cuenta para logros.
- **Casilla activada:** Settings → Profile → *Show Achievements on my profile*.
  <https://github.com/settings/profile>
- **Paciencia:** de minutos a horas hasta que aparecen en el perfil.
