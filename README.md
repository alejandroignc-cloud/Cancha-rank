# ⚽ CanchaRank

**Tu liga. Tu legado.** Plataforma privada para evaluar jugadores de fútbol real después de cada partido, elegir al MVP y construir una clasificación histórica entre amigos.

[Ver repositorio](https://github.com/alejandroignc-cloud/Cancha-rank)

## ¿Qué incluye?

- Interfaz responsive para celulares y computadores, diseño oscuro con acentos verde lima.
- Acceso con correo y contraseña; ingreso opcional por enlace al correo.
- Solicitud de acceso y aprobación por el administrador.
- Jugadores con posición, dorsal y cuenta vinculada (impide la autoevaluación).
- Jornadas con fecha, lista de convocados y votación abierta/cerrada.
- Calificaciones **enteras de 0 a 10** y elección de un **MVP** por papeleta.
- Una sola papeleta por cuenta y jornada. Los votos individuales están protegidos.
- Clasificaciones **por jornada**, **por año** y **histórica**.
- Puntos = suma de todas las notas recibidas + **3 puntos por cada voto a MVP**.
- Estadísticas de partidos, goles, asistencias, notas y MVP; perfil con gráfico de evolución por jornada.
- Panel de administración: crear/editar jugadores, vincular miembros, gestionar jornadas, convocados, resultados y solicitudes.
- Supabase PostgreSQL con RLS y RPC seguras. Sin datos ficticios cargados en producción.

## Cómo publicar gratis en GitHub Pages

1. Entra en **Settings → Pages** dentro de este repositorio.
2. En **Build and deployment → Source**, selecciona **Deploy from a branch**.
3. En la rama, elige **main** y la carpeta **/(root)**. Pulsa **Save**.
4. GitHub publicará la página en:
   **https://alejandroignc-cloud.github.io/Cancha-rank/**

El repositorio es público, pero los datos de la liga **requieren una cuenta aprobada** y se protegen en Supabase.

## Configuración de Supabase Auth (importante)

En el proyecto de Supabase, abre **Authentication → URL Configuration**.

- **Site URL**: `https://alejandroignc-cloud.github.io/Cancha-rank/`
- **Redirect URLs**: agrega `https://alejandroignc-cloud.github.io/Cancha-rank/**`

Esto es necesario para que funcionen bien los enlaces de confirmación de correo y los accesos por correo. En **Authentication → Providers → Email**, revisa que el inicio de sesión con correo esté habilitado. El correo de confirmación depende de los límites de envío del plan gratuito.

En **Authentication → Security and Protection**, activa las protecciones de contraseñas que tengas disponibles. Una revisión del proyecto detectó que la protección contra contraseñas filtradas no está activada.

## Primer acceso del administrador

La cuenta existente del propietario `alejandroignc@gmail.com` ya está incluida en `admins` y aprobada en `members`. Accede con esa cuenta (contraseña o enlace por correo).

Para comenzar:
1. **Administrar → Jugadores**: agrega los jugadores reales del equipo, sus posiciones y dorsales.
2. **Administrar → Jornadas**: crea la primera fecha y entra a **Editar** para seleccionar convocados.
3. **Administrar → Jornadas → Abrir**: habilita la votación.
4. Comparte la URL con tus amigos. Cada uno se registra y solicita acceso.
5. **Administrar → Solicitudes**: aprueba a los miembros.
6. Cuando voten, aparecerán los resultados en Clasificación, perfiles y estadísticas.

Para evitar la autoevaluación, en **Editar jugador** vincula a cada jugador con su cuenta registrada antes de iniciar las votaciones.

## Arquitectura

- **Frontend:** HTML5, CSS3, JavaScript (módulos ES), sin compilación ni Node obligatorios.
- **Cliente:** `@supabase/supabase-js@2.87.3` desde CDN.
- **Backend:** Supabase Auth + PostgreSQL (tablas de jugadores, jornadas, miembros, votaciones, calificaciones y actuaciones).
- **Clave pública:** `config.js` contiene una clave `sb_publishable_`, **diseñada para navegador**. Nunca agregues claves `service_role` ni tokens secretos al repositorio.

## Seguridad

- Las tablas están protegidas con RLS.
- Las personas pendientes o bloqueadas no pueden ver datos de la liga ni votar.
- Las calificaciones individuales y el identificador de quien votó no tienen lectura pública ni directa para miembros.
- Se publican únicamente estadísticas agregadas a través de funciones limitadas a miembros aprobados.
- `submit_ballot` verifica usuario aprobado, jornada abierta, notas 0–10, MVP elegible, exclusión del propio jugador y unicidad del voto.
- Después de que una jornada recibe votos, su lista de participantes ya no se puede alterar; sí se pueden completar goles y asistencias.

## Pruebas realizadas

- Verificación directa del esquema y permisos en Supabase.
- Prueba transaccional del proceso de votación y cálculo de puntos, seguida de **ROLLBACK**: no se introdujeron jugadores ficticios.
- Prueba de generación de las pantallas HTML (visitante, administrador, lista vacía y lista con datos de prueba).
- Comprobación de sintaxis del módulo JavaScript.

**Pendiente de verificar desde un navegador publicado:** confirmación de correo, login real con redirect, permisos de Pages, experiencia en móvil real y flujo completo entre varios usuarios. Esta fase depende de habilitar Pages y configurar los Redirect URLs.

## Limitaciones deliberadas

- La plataforma evalúa **partidos reales del equipo**; no predice resultados ni importa estadísticas externas.
- Los datos no se inventan: el administrador registra jugadores, fechas y actuaciones reales.
- No hay un sistema de edición de votos después de enviados; evita alterar resultados.
- El administrador no puede ver el detalle de votos individuales desde la web.
