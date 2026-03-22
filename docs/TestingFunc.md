
# Forntends
## admin-ui
## binpack-ui
## live-labeling-ui
## sap-map-ui
## sap-sync-ui

# Backends
## auth-service
## binpack-service
## inventory-service
## labeling-service
## orders-service
## reporting-service
## sap-b1-adapter-service
## sensor-ingest-service

# Usertest result

# ------- admin-ui ------------------------------------- 
## Time: 2026-03-13 07:08
### admin-ui
- http://localhost:5176/users --> Uncaught TypeError: Cannot read properties of undefined (reading '0') at Object.Cell (Users.tsx:304:31)
- GET http://localhost:5176/maps/shapes --> 502 (Bad Gateway)
- GET http://localhost:5176/maps/history --> 502 (Bad Gateway)
- GET http://localhost:5176/maps/geojson --> 502 (Bad Gateway)
- POST http://localhost:5176/files/ --> 404 (Not Found)

- change appbar, sidebar to mui Responsive drawer --> coloring schema (light, dark) as in "muiTheme.ts"
- delete typography page and all its components
role - varchar(50) - 'viewer'::character varying

## Time: 2026-03-13 08:04
### admin-ui - auth-service
- http://localhost:5176/users --> list user from postgers db --> auth_users table
- - change table structure --> instead "role" create row with an object of services / role --> **What is your proposal?**
CREATE TABLE "public"."auth_users" (
...
    "role" varchar(50) NOT NULL DEFAULT 'viewer'::character varying, 
...
);
ROLES=["superadmin", "admin', "viewer", "operator", "servicbroker", "dbadmin"] something like that --> **opinion?**
SERVICES=["auth-service","binpack-service","inventory-service","labeling-service","orders-service","reporting-service","sap-b1-adapter-service","sensor-ingest-service"]

- POST http://localhost:5176/files/ --> 404 (Not Found) --> 
- - create a base folder and 
- - in the upload form "Folder" input change to autocomplet to choose existing subforlder or create a new (create it before upload)

## Time: 2026-03-13 08:04
### admin-ui - auth-service
- PUT http://localhost:5176/users/me 404 (Not Found) --> can't save mod
- - add avatar field in to db --> empty | base64 image

- GET http://localhost:5176/auth/users/ 404 (Not Found)

modified the auth-table?
backend restart? --> doit

## Time: 2026-03-13 09:04
### admin-ui - auth-service
- usersSlice.ts:59  GET http://localhost/auth/users 401 (Unauthorized)

## Time: 2026-03-13 09:25
### admin-ui - auth-service
- usersSlice.ts:59  GET http://localhost/auth/users 401 (Unauthorized)
  After secleted the "users" menu, it redirect to the sigin page

### all frontend
Use in all frontends the "react-toastify": "^11.0.5" for messaging


## Time: 2026-03-13 09:27
### admin-ui - auth-service
- usersSlice.ts:59  GET http://localhost/auth/users 401 (Unauthorized)
  After secleted the "users" menu, it redirect to the sigin page

## Time: 2026-03-13 09:33
### admin-ui - auth-service
- modify the users page table rows --> DB auth_users table schema
- modify the create new user / edit user form too
- use Toastify displaying each backend interaction respons, each modifications respons 

## Time: 2026-03-13 09:44
### admin-ui - auth-service
- modify the create new user / edit user form too --> Service Role Overrides (blank = inherit global role) --> add new role: forbinned

## Time: 2026-03-13 09:44
### admin-ui - auth-service
- modify the users page table culumns --> DB auth_users table schema --> "Service Roles" in case all display all services

## Time: 2026-03-13 10:40
### admin-ui - auth-service
- GET http://localhost:5176/maps/shapes --> 502 (Bad Gateway)
- GET http://localhost:5176/maps/history --> 502 (Bad Gateway)
- GET http://localhost:5176/maps/geojson --> 502 (Bad Gateway)

## Time: 2026-03-13 11:40
### admin-ui - auth-service
- use Toastify displaying each backend interaction responses, each modifications responses 


## Time: 2026-03-13 12:20
### admin-ui - auth-service
- remove pages/maps --> archive in a zip

## Time: 2026-03-13 12:25
### admin-ui - auth-service - global
- POST http://localhost:5176/files/ --> 404 (Not Found) --> 
- - create a base folder (files)  
- - in the upload form change "Folder" input to autocomplet to choose existing subforlder or create a new (create it before upload)
- add a DB for store uploaded files
- this DB should be accessible for any services
- files should be store physically in the "files" folder

## Time: 2026-03-13 13:15
### admin-ui - auth-service
users --> edit/new form not sending the "avatar_mode" and "avatar_base64"
- "avatar_mode": "image",
- "avatar_base64": "data:image/png;base64,...."

Result:
{
    "id": 2,
    "username": "...",
    "name": "...",
    "email": "...",
    "role": "admin",
    "service_roles": {
        "auth-service": "forbidden",
        "sensor-ingest-service": "viewer",
        "sap-b1-adapter-service": "viewer"
    },
    "status": "active",
    "joined": "2026-03-13T11:48:42.581379+00:00",
    "avatar_mode": "letter",
    "avatar_base64": NULL
}

## Time: 2026-03-13 13:30
### admin-ui - auth-service
- file: add mp4 to the allowed upload list

## Time: 2026-03-13 13:35
### admin-ui - auth-service - global
- Roles and perimissons --> "admin" can't edit, update, delete "superadmin" and stuffs
- create an Roles and perimissons map --> store it in the auth_db

## Time: 2026-03-13 13:50
### admin-ui - auth-service - global
- Roles and perimissons --> "admin" can edit, update, delete "admin" and its stuffs

- Make this for all rols 
{"admin": {"maps": ["create", "read", "update", "delete"], "files": ["create", "read", "update", "delete"], "users": ["create", "read", "update", "delete"], "reports": ["create", "read", "update"], "sensors": ["read"]}, "viewer": {"maps": ["read"], "files": ["read"], "users": [], "reports": ["read"], "sensors": ["read"]}, "operator": {"maps": ["read"], "files": ["create", "read", "update"], "users": ["read"], "reports": ["read"], "sensors": ["create", "read"]}, "superadmin": {"maps": ["create", "read", "update", "delete"], "files": ["create", "read", "update", "delete"], "users": ["create", "read", "update", "delete"], "reports": ["create", "read", "update", "delete"], "sensors": ["create", "read", "update", "delete"]}}

- create a page for editing roles under users

## Time: 2026-03-13 17:50
### admin-ui - auth-service
- in users list superadmin can't edit itself? correct it

- Role Permissions page work as expected!
- - superadmin can change
- - admin only view

## Time: 2026-03-13 19:20
### admin-ui - auth-service - file-service
- store the uploader (id? / usermane?) identity
- user can CRUD own upload files
- superadmin can CRUD everyone upload files
- add video viewer to the preview modal


 
## Time: 2026-03-13 20:01
### sap-sync-ui 
- modify the signin page as in the one in auth-ui
- change appbar, sidebar to mui Responsive drawer 
- chagne coloring schema (light, dark) define in "muiTheme.ts" --> light color:default blue; dark color: ???? your oppinion?
- use react-redux 
- user auth --> auth_db

## Time: 2026-03-13 20:30
### sap-sync-ui 
- change Login.tsx to Signin.tsx
- In new Signin video not playing --> check in admin-ui too, because neighter plays
- change the current auth mechamins to admin-uis one 
- GET http://localhost/sap/jobs 403 (Forbidden)


## Time: 2026-03-13 21:00
### sap-sync-ui - sap-b1-adapter-service
Build ui from the scratch!
1. clone admin-ui
2. chagne coloring schema (light, dark) define in "muiTheme.ts" --> light color:default blue; dark color: ???? your oppinion? 
3. pages/Jobs.tsx and pages/db-tools are important
4. route: 
4.1. Logs / Jobs.tsx
4.2. Sync tools / Sync, Async Sync, Scheduled Sync
5. check sap-b1-adapter-service for auth

# ------- binpack-ui -------------------------------------
## Time: 2026-03-13 22:00
### binpack-ui - binpack-service
1. clone admin-ui
2. chagne coloring schema (light, dark) define in "muiTheme.ts" --> light color:default #33338f; dark color: ???? your oppinion? 
3. admin sidebar - no link instead transpose current sidebar to it
4. admin appbar no changes
5. current header / appbar --> instert before three canvas
6. use toostify
7. use current log modal

## Time: 2026-03-14 07:30
### binpack-ui - binpack-service
- after login avatar not showing
  

In admin-ui header the following code must be use:
        <IconButton onClick={handleAvatarClick} sx={{ ml: 1 }}>
          <Avatar
            src={user?.avatar_mode === 'image' && user.avatar_base64 ? user.avatar_base64 : undefined}
            sx={{ bgcolor: 'primary.light', width: 36, height: 36, fontSize: '1rem' }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </Avatar>
        </IconButton>

instead
        <IconButton onClick={handleAvatarClick} sx={{ ml: 1 }}>
          <Avatar sx={{ bgcolor: 'white', color: 'primary.main', width: 36, height: 36, fontSize: '1rem', fontWeight: 700 }}>
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
        </IconButton>

## Time: 2026-03-14 10:00
### binpack-ui - binpack-service
- modify code: remove condition "{showStack && (" , but the inside code stay

        {layersInPackage > 1 && (
            <Typography variant="body2">
              Rolls/package: <strong>{packSize * layersInPackage}</strong> ({packSize} × {layersInPackage} layers)
            </Typography>
          )}
          {showStack && (
            <>
              <Typography variant="body2">Pkg layers on pallet: <strong>{pkgLayersOnPallet}</strong></Typography>
              <Typography variant="body2">
                Stack height: <strong>{(pkgLayersOnPallet * layersInPackage * rollHeight).toFixed(0)} mm</strong>
              </Typography>
            </>
          )}

# ------- sap-sync-ui -------------------------------------
## Time: 2026-03-13 22:00 
### sap-sync-ui - sap-b1-adapter-service

1. add: react-redux, react-toastify, material-react-table, @tanstack/react-table
2. in the DB add user to sync job!!
3. change Jobs.tsx table to material-react-table

## Time: 2026-03-13 12:10 
### sap-sync-ui - sap-b1-adapter-service
1. add another route 
{
    path: '/querys',
    protected: true,
    icon: ????,
    label: 'Querys',
    showInNav: true,
    children: [
      { path: '/querys/list', element: ????, protected: true, icon: ?????, label: 'Querys list', showInNav: true },
      { path: '/querys/builder',element: ????,protected: true, icon: ????,  label: 'Query builder',showInNav: true },
      { path: '/querys/timeing', element: ????, protected: true, icon: ????, label: 'Crontabing', showInNav: true },
    ],
  },
2. create pages + slices
3. in the Sync.tsx add option to download query result to excel (xlsx) 
4. in /querys/builder save the query to DB: wrk_QueryDef table 
4.1. --> sql_original --> the original query
4.2. --> sql_b1_comp_base_query --> this is for SAP B1 api compacitibily --> used ~dev/sap/backend/app3/excel_export/sql_preprocessor.py
4.3. --> sql_b1_comp_extra_options --> extra columns which usually calculation, fuction, etc --> sql_preprocessor.py

My_OpenOrders
qrySalesOrders
SELECT TOP 100
  T0.DocNum      AS [Rendelés szám],
  T0.DocDate     AS [Rendelés dátum],
  T0.CardCode    AS [Vevőkód],
  T0.CardName    AS [Vevőnév],
  T1.ItemCode    AS [Cikkszám],
  T1.Dscription  AS [Megnevezés],
  T1.Quantity    AS [Rendelt mennyiség],
  T1.OpenQty     AS [Nyitott mennyiség]
FROM ORDR T0
JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
WHERE T0.DocStatus = 'O'
ORDER BY T0.DocDate DESC, T0.DocNum DESC

## Time: 2026-03-13 13:10 
### sap-sync-ui - sap-b1-adapter-service
- in querys/query builder --> if "Target table" is empty, than 
- - add comment table name / EXCEL
- db-tools/sync --> in case "Target table" is empty --> 
- - after runing sync save logs_SyncJobs int the target_table field: EXCEL
- - download query result to excel

## Time: 2026-03-13 18:10 
### sap-sync-ui - sap-b1-adapter-service
- sync --> My_OpenOrders / qrySalesOrders --> {"detail":"Insufficient permissions"}
- sync --> Raktarkeszlet_ALAP_aktualis / --> {"detail": "404 Client Error: Not Found for url: https://172.22.248.4:50000/b1s/v1/SQLQueries('Raktarkeszlet_ALAP_aktualis')/List"}

# ------- admin-ui ------------------------------------- 
## Time: 2026-03-14 19:30
### admin-ui - auth-service
Modify the users/permissions! The current table is good base. 
Headers:
- Resource --> change the curent source --> auth_db - services table
- Roles: add globally a new role --> worker
DB:
- i added a new field --> role_name
- permissions field: The origial opbject need to be separated for each role in the permissions field!
{"admin": {"maps": ["create", "read", "update"], "files": ["create", "read", "update"], "users": ["create", "read", "update", "delete"], "reports": ["create", "read", "update"], "sensors": ["read"]}, "viewer": {"maps": ["read"], "files": ["read"], "users": [], "reports": ["read"], "sensors": ["read"]}, "operator": {"maps": ["read"], "files": ["create", "read", "update"], "users": ["read"], "reports": ["read"], "sensors": ["create", "read"]}, "superadmin": {"maps": ["create", "read", "update", "delete"], "files": ["create", "read", "update", "delete"], "users": ["create", "read", "update", "delete"], "reports": ["create", "read", "update", "delete"], "sensors": ["create", "read", "update", "delete"]}}

# ------- sap-sync-ui -------------------------------------
## Time: 2026-03-14 20:20 
### sap-sync-ui - sap-b1-adapter-service
querys/query builder
- add dropdown list with the service "pascal_name" from auth_db. Only those for which user has permission 
- service_name field already added to DB --> modify slice
querys/query list
- add header column: "pascal_name" of service 
db tools/sync
- select saved query -->  Only those for which user has permission based service permission 
db tools/SyncScheduled
- in this page all query are listed
- surpeadmin, admin, worker have permission
- in this page cron jobs are setup

## Time: 2026-03-14 20:50 
### sap-sync-ui - sap-b1-adapter-service
db tools/sync
- select saved query -->  Only those for which user has permission based service permission 
NOT WORKING!!
Check user service permissions in the auth_db role_permissions table for user role
Check MS SQL ReporingDB wrk_QueryDef table for servives


## Time: 2026-03-14 21:20 
### sap-sync-ui - sap-b1-adapter-service
querys/timeing when page refresh:
- installHook.js:1 React has detected a change in the order of Hooks called by QueryTiming
- Uncaught Error: Rendered more hooks than during the previous render.


# ------- admin-ui ------------------------------------- 
## Time: 2026-03-15 10:15
### admin-ui - auth-service
Add another route services
- services/list --> name, pascal case name, url, status, action
- services/manage

List:
- show status
- edit
Manage:
- start/stop/restart
- recent log

Dashbard
- Users --> link to users/list
- Files --> link to files/files2
- Queries --> in a modal curl "localhost:5173/querys/list" and list (name, description, service)
- Service Health --> link to services/manage/{name}

## Time: 2026-03-15 10:40
### admin-ui - auth-service
Dashbard - Queries --> in a modal curl "localhost:5173/querys/list" and list (name, description, service)
- service --> "_"
- target table --> "-"

services/list 
- show status not valid -->last kwon status must be stored somewere --> in this page show the aclutal stat

Correct all of it!

**YOUR Note**: The POST /auth/services/{id}/action backend endpoint doesn't exist yet — DO IT!!, and use BINPACK logwindow los show the termilas respons

## Time: 2026-03-15 10:55
### admin-ui - auth-service
- Manage Service page: add a "Back" button linked to services/list
- use VITE_APP_SERVICE_CHECK_INTERVAL to set services check interval sitewide
- Make Command : make up-labeling  --> on "Refresh" Terminal Output: 
[10:46:50 AM] ▶ docker restart microservices-labeling-service-1
[10:46:50 AM] ✗ Error: Docker CLI not found. Ensure /var/run/docker.sock is mounted and docker.io is installed.

## Time: 2026-03-15 11:55
### admin-ui - auth-service - sap-b1-adapter-service
Dashboard - "Queries" cards --> change modal
- add a "Run sync" button (only when Target Table isn't empty) --> call an async-sync 
- add an async endpoint to "sap-b1-adapter-service"
- add an sync type header to Recent Sync Jobs table
- wait for the async try/catch response -->
- - show the result log
- - refresh --> Queries card, Recent Sync Jobs table

i ALTERed the TABLE logs_SyncJobs
ADDed a CONSTRAINT CHK_logs_SyncJobs_sync_type
CHECK (sync_type IN ('sync','async','scheduledsync'));

# ------- live-labeling-ui ------------------------------------- 
## Time: 2026-03-15 13:30
### live-labeling-ui - labeling-service
1. clone admin-ui
2. chagne coloring schema (light, dark) define in "muiTheme.ts" --> current is dark, light: your oppinion?
3. current sidebar go to the new
4. sidebar title: CAB SQUIX
5. Navbar 
   1. Title: Label design
   2. label sizees, buttons stays
6. Main section
   1. Tabbed design as current
   2. Designer tab --> 
- USE KONVA --> use /Users/pisti/My Projects.local/dev/VandZ/React - QR - THREE - excel import/frontend/src/features/LabelEditor2/ as example
- on the current sidebar are: Text, Image, --> on the improved version too
- Barcode - Users/pisti/My Projects.local/dev/VandZ/React - QR - THREE - excel import/frontend/src/features/ProductCode/components/BarCode3.jsx
- add QR 
- add DataMaxrix - /Users/pisti/My Projects.local/dev/VandZ/React - QR - THREE - excel import/frontend/src/features/ProductCode/components/Datamatrix.jsx

Every object must be:
- editable --> Text size, Bold
- resizeable
- moveable
- deletable


## Time: 2026-03-15 19:50
### live-labeling-ui - labeling-service
- Konva --> change enabledAnchors and positions. If element is outside the canvasm than anchors must be inside the canvas
- Add zoom slider that zoom the whole canvas
- Check the resizing (observer)


## Time: 2026-03-15 20:50
### live-labeling-ui - labeling-service
Correct the anchorpoit problem --> when object rotated, the positioing calcaluted wrong!!!!!!!!!

- Add: custom sizing --> save as template ?
- Add: snapping --> https://www.bigbinary.com/blog/shape-snapping-with-react-konva
Add dnd:
```js
// Drag & Drop Begin
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnd = (index, newProps) => {
    const newObjects = objects.slice();
    newObjects[index] = { ...newObjects[index], ...newProps };
    setObjects(newObjects);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    stageRef.current.setPointersPositions(e);
    const reader = new FileReader();
    const file = e.dataTransfer.files[0];

    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const mouse = stageRef.current.getPointerPosition()
        const scale = calculateResizeRatio(width, height, mouse.x, mouse.y, img.width, img.height)
        //console.log('mouse', mouse, scale)
        setObjects((prevObjects) => [
          ...prevObjects,
          {
            id: nanoid(),
            type: Image,
            image: img,
            strokeWidth: 2,
            width: img.width * scale,
            height: img.height * scale,
            ...stageRef.current.getPointerPosition()
          },
        ]);
      };
    };

    reader.readAsDataURL(file);

    // if (file) {
    //   if (file.type.startsWith('image/svg')) {
    //     // Handle SVG differently
    //     reader.readAsText(file);
    //   } else {
    //     reader.readAsDataURL(file);
    //   }
    // }
  };
```


## Time: 2026-03-16 07:15
### live-labeling-ui - labeling-service
Size calculation during zoom change not working. Mac screen pixel ratio must checkd.
I added 2 additioal Layer:
- background-layer --> gb color setup
- grid-layer --> making a grid
- "data-layer" --> put here the custom elemets
Use following code in "grid-layer" 
```js 
useEffect(() => {
    if (stageRef.current?.children?.length < 2) return null
    // Access Konva stage and layer
    const stage = stageRef.current.getStage();
    const layers = stageRef.current.children;
    const layer = layers[1]
    console.log('layer', layer)
    //return
    // Draw horizontal grid lines
    for (let i = 5; i <= heightCM * 10; i += 5) {
      let hline = new Konva.Line({
        points: [0, i * 10, 210 * 10, i * 10],
        stroke: 'lightgrey',
        strokeWidth: 0.5,
      })
      layer.add(hline);
    }

    // Draw vertical grid lines
    for (let i = 5; i <= widthCM * 10; i += 5) {
      let vline = new Konva.Line({
        points: [i * 10, 0, i * 10, 180 * 10],
        stroke: 'lightgrey',
        strokeWidth: 0.5,
      })
      layer.add(vline);
    }

    // Update layer
    layer.batchDraw();
  }, [stageRef.current?.children]);
  ```

## Time: 2026-03-16 09:30
### live-labeling-ui - labeling-service
Template saving improve with a base64 preview image --> 	labling_db --> label_templates --> preview	bytea	YES	NULL	NULL		NULL
Now add load button and a modal, to search saved temples and add to canvas

## Time: 2026-03-16 11:10
### live-labeling-ui - labeling-service
- When adding text, the object is selected and anchorpoint added.
- When addig image, barcode, datamarix, the no anchorpoint added. Fist need click an empty area and select the object again.
- in Barcode properties missing the height imput. This height is the bwipjs height.
Missing input:
```js
<TextField
                  id="outlined-basic"
                  label="Height"
                  variant="outlined"
                  name="height"
                  type='number'
                  value={state.height}
                  onChange={handleInputChange}
                  style={{ width: '10ch' }}
                />
```
Exemple state:
```js
const [state, setState] = useState(
    {
      barcodeValue: "Count01234567!", //"30601986974821", "(01)09521234543213(3103)000123", "9520123456788",
      format: "code128", //"code128", "code39", "ean13",
      scale: 2,
      height: 20,
      svg: ''
    }
  )
```
BWIPJS call:
```js
bwipjs.toCanvas('mycanvas', {
        bcid: data.format,       // Barcode type
        text: data.barcodeValue,    // Text to encode
        scale: data.scale,               // 3x scaling factor
        height: data.height,              // Bar height, in millimeters
        includetext: true,            // Show human-readable text
        textxalign: 'center',        // Always good to set this
        //backgroundcolor: '#ffffff'
      });
```

## Time: 2026-03-16 11:10
### live-labeling-ui - labeling-service
Add sorting order to "Layers". Order represent the vertical order o the canvas (send back, send top)



## Time: 2026-03-16 11:10
### live-labeling-ui - labeling-service
- Most important --> canvas resolution must be 300 dpi. And by saveing the image resolution too!!!
- After that, when in Barcode properties the height changes, the object height is must be change!!!! 

## Time: 2026-03-16 12:10
### live-labeling-ui - labeling-service
- add circle, retcangle object
- each properties:
- - fill color: black/withe/trapparent
- - border color: black/withe/trapparent
- - border thickness


## Time: 2026-03-16 13:00
### live-labeling-ui - labeling-service
Change bwipjs.toCanvas to bwipjs.toSVG, because resolution is worst.

Try use SVG = bwipjs.toSVG in renderBwip fucntion
```js
bwipjs.toSVG({
        bbcid: data.format,       // Barcode type
        text: data.barcodeValue,    // Text to encode
        scale: data.scale,               // 3x scaling factor
        height: data.height,              // Bar height, in millimeters
        includetext: true,            // Show human-readable text
        textxalign: 'center',        // Always good to set this
});
```

# ------- sap-sync-ui ------------------------------------- 
## Time: 2026-03-16 14:00
### sap-sync-ui - sap-b1-adapter-service
Q&A: 
- When new SQL stored, 
- - the tables begining with "qry_" are listed?
- - no db table exits, on first syn run the the table will be created?

## Time: 2026-03-16 19:00
### sap-sync-ui - sap-b1-adapter-service
**Summary flow - TODO**
Save query in Query Builder
  → stored in MSSQL: dbo.wrk_QueryDef (sql_original + preprocessed)
First sync run (create_if_missing=True)
  → SAP B1: GET /SQLQueries('{name}') → 404
  → SAP B1: POST /SQLQueries  (registers it)
  → SAP B1: POST /SQLQueries('{name}')/List  (fetches rows)
  → MSSQL: CREATE TABLE if not exists
  → MSSQL: INSERT rows

## Time: 2026-03-16 19:30
### sap-sync-ui - sap-b1-adapter-service
Query builder page
- Add lenght check to "Query name" input and add help text --> "SAP B1 SqlCode must be ≤ 20 characters. Rename the query in Query Builder."


# ------- sap-map-ui ------------------------------------- 
## Time: 2026-03-18 18:50
### sap-map-ui - maps-service
1. clone admin-ui
2. chagne coloring schema:
const theme = createTheme({
  palette: {
    primary: {
      main: '#d4e157',
    },
    secondary: {
      main: '#ffab00',
    },
  },
});

## Time: 2026-03-18 19:50
### sap-map-ui - maps-service
landing video with: width: calc(100vw - 420px);
main (map) width:    width: calc(100vw - 240px);
use /frontend/sap-map-ui/src/resources/sources/mock_HU.tsx instead /frontend/sap-map-ui/src/resources/api/mock.tsx

SELECT
    p.CardCode,
    p.CardName,
    p.CardFName,
    p.CardType,
    a.AdresType,
    a.Address       AS AddressName,
    a.Street,
    a.StreetNo,
    a.Block,
    a.ZipCode,
    a.City,
    a.County,
    a.Country
FROM OCRD p
LEFT JOIN CRD1 a ON p.CardCode = a.CardCode
ORDER BY p.CardCode, a.AdresType



# ------- s7-status-ui ------------------------------------- 
## Time: 2026-03-20 13:20
### s7-status-ui - upcua-service - upcua-simalator
- Your last question:
I don't find working_speed anywhere — it doesn't exist yet. Could you clarify what you mean?

Do you want to add a new sensor unit called Working Speed with range 0–500 rpm?
Or does the sensor_units table need a range column (min_val / max_val) and you want to set 0–500 for a speed unit?
Or is this about something else — the simulator, a node definition, or a different part of the UI?

- My Answer
I add a new sensor unit with range 0–500 m/min.

We need to add parameter for the nodes. We need to specified the behavering of that node:
- sinus in [range]
- random in [range]
- up - stay - down [range]
- like voltange level
- etc --> industrial standards



{
  palette: {
    primary: deepPurple,
    secondary: {
      main: '#ffab00',
    },
  },
}

# ------- sap-sync-ui ------------------------------------- 
## Time: 2026-03-21 19:30
### sap-sync-ui - sap-b1-adapter-service
In New Query page:
- change description to mandantory / required
In Edit Query page
- change description to mandantory / required

Booth pages complete save/update fuction. This data must be saved to the wrk_TableDesc table:
- dst_table
- description
- username

If dst_table === EXCEL, bypass save/update


## Time: 2026-03-21 20:30
### sap-sync-ui - sap-b1-adapter-service

Find a solution for SQL query which hasn't id field. This solution can run in sync process. 
If - DB opreration - exsiting table doesn't have id field, than add one, but leave the SQL query intact.
If - EXCEL opreration - the result must have ID field
