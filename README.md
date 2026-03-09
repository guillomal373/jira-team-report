# Jira Team Report

Dashboard web estatico para visualizar metricas de equipo y sprints a partir de exportes CSV de Jira. La pagina consume archivos JSON/CSV locales y dibuja graficas con Chart.js para ver tendencias de story points, rendimiento por miembro y un tablero resumido del sprint actual.

**Caracteristicas principales**
- Tendencia diaria de story points por estado y por miembro.
- Matriz de story points completados por miembro.
- Tabla completa del CSV con filtros por assignee y status.
- Vista rapida por sprint seleccionable.

**Como ejecutarlo**
1. Entra a la carpeta del proyecto:
```
cd /Users/guillermomalagon/Library/CloudStorage/OneDrive-DSSOLUTIONSS.A.S/Documentos/team-gamification/jira-team-report
```
2. Inicia un servidor local (recomendado para que `fetch` lea JSON/CSV):
```
python3 -m http.server 8080
```
3. Abre en el navegador:
```
http://localhost:8080
```

**Estructura clave**
- `index.html`: layout y secciones del dashboard.
- `styles.css`: estilos y tema visual.
- `script.js`: carga de datos, agregaciones y graficas.
- `data/team.json`: miembros, roles, alias de Jira y configuracion visual.
- `data/sprints.json`: catalogo de sprints y ruta del CSV por sprint.
- `data/sprint_story_points.json`: series diarias de story points por sprint.
- `data/sprints-csv/`: exportes CSV de Jira por sprint.

**Formato esperado del CSV**
El dashboard necesita al menos estas columnas (los nombres son los del export de Jira):
- `Assignee`
- `Status`
- `Custom field (Story point estimate)` o cualquier columna que contenga `Story point`
- `Updated` (o `Created`, `Start Date`, `Due Date` como alternativa para fechas)

**Actualizar datos (nuevo sprint)**
1. Exporta el sprint desde Jira en CSV (idealmente “Sprint Summary export”).
2. Guarda el archivo en `data/sprints-csv/`.
3. Agrega una entrada en `data/sprints.json` con `name`, `period` y `csvFile`.
4. (Opcional) Actualiza `data/sprint_story_points.json` si quieres la tendencia diaria.
5. Si cambia el nombre de un assignee en Jira, agrega un alias en `data/team.json` usando `csvAliases`.

**Solucion de problemas**
- No aparecen datos: verifica los nombres de columnas del CSV y que el servidor local este corriendo.
- Filtros vacios o miembros faltantes: revisa `data/team.json` y agrega `csvAliases`.
- Errores de carga en `file://`: usa `python3 -m http.server` en vez de abrir el HTML directo.
