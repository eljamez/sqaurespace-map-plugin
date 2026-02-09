# Squarespace Map Plugin

A lightweight plugin that displays an interactive **Google Map** on your Squarespace site, with marker data loaded from a **Google Sheet**. Ideal for store locators, event venues, or any list of locations.

---

## What You Need

| Requirement | Purpose |
|-------------|---------|
| **Google Sheet ID** | The spreadsheet that holds your location data (name, coordinates or address, description, links). |
| **Google Maps API key** | Used in the browser to load the map and (optionally) geocode addresses. |
| **Hosted plugin script** | The built JavaScript file must be served from a URL (e.g. GitHub Pages, Netlify, or your own host). |

No backend or Squarespace Developer Platform is required: you use a **Code Block** (or Code Injection) and point the script at your sheet and API key.

---

## 1. Set Up Your Google Sheet

### 1.1 Create the spreadsheet

Create a new Google Sheet and use these **exact column headers** in the first row:

| Column     | Required | Description |
|-----------|----------|-------------|
| **Name**  | Yes      | Location name (e.g. store or venue name). |
| **Latitude**  | Yes* | Latitude (e.g. `40.7128`). |
| **Longitude** | Yes* | Longitude (e.g. `-74.0060`). |
| **Address**   | Yes* | Street address. Used only when Latitude/Longitude are empty; the plugin will geocode it. |
| **Description** | No  | Text shown in the marker’s info window. |
| **LinkURL**   | No  | URL for a “Learn more” link in the info window. |
| **LinkText**  | No  | Label for that link (default: “Learn more”). |

\* Each row must have either **Latitude + Longitude** or **Address**. Rows with only an address are geocoded (and results cached in the browser).

Example:

| Name    | Latitude | Longitude | Address        | Description   | LinkURL | LinkText   |
|---------|----------|-----------|----------------|---------------|---------|------------|
| Store 1 | 40.7128   | -74.0060  |                | Downtown NYC  | https://… | Visit store |
| Store 2 |          |           | 123 Main St…   | Main location | https://… | Website    |

### 1.2 Publish the sheet to the web

The plugin reads your sheet as CSV. You must publish it:

1. In Google Sheets: **File → Share → Publish to web**.
2. Choose the sheet (or “Entire workbook”) and **CSV**.
3. Click **Publish** and confirm.

Your sheet is now available at a URL that includes its ID.

### 1.3 Get your Sheet ID

Open your sheet in the browser. The URL looks like:

```text
https://docs.google.com/spreadsheets/d/1ABC123xyz/edit
```

The **Sheet ID** is the long string between `/d/` and `/edit`:

```text
1ABC123xyz
```

Copy this; you’ll use it as `sheetId` in the plugin config.

---

## 2. Get a Google Maps API Key

The plugin uses the **Maps JavaScript API** (and the **Geocoding API** if you use the Address column). You need one API key, created in Google Cloud.

### 2.1 Create a project and enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.
3. Open **APIs & Services → Library**.
4. Search for and **enable**:
   - **Maps JavaScript API**
   - **Geocoding API** (only if you use the Address column)

### 2.2 Create an API key

1. Go to **APIs & Services → Credentials**.
2. Click **Create credentials → API key**.
3. Copy the new key. You can optionally click **Edit API key** to:
   - **Restrict key**: under “Application restrictions” choose **HTTP referrers** and add your Squarespace domain(s), e.g.:
     - `https://yoursite.squarespace.com/*`
     - `https://www.yourdomain.com/*`
   - **Restrict APIs**: limit the key to “Maps JavaScript API” and “Geocoding API” only.

Use this key as `apiKey` in the plugin config. Never commit it to public repos.

---

## 3. Build and Host the Plugin Script

The plugin is a single JavaScript file that must be loaded from a URL.

### 3.1 Build

From the project root:

```bash
npm install
npm run build
```

The output is in **`dist/`**. The main script is:

```text
dist/assets/index-XXXXXXXX.js
```

The hash in the filename may change when you rebuild.

### 3.2 Host the file

Upload the built script to a host that serves it over HTTPS, for example:

- **GitHub Pages**: Use the **docs** folder: enable Pages → “Deploy from a branch” → choose the branch and **/docs** as the folder. The repo includes a landing page at `docs/index.html` with instructions and a copy-to-clipboard embed code. Copy `dist/assets/index-XXXXXXXX.js` to `docs/assets/map-plugin.js` (or keep the hashed name and update the landing page) so the script is at `https://yourusername.github.io/repo/assets/map-plugin.js`.
- **Netlify / Vercel**: drag the `dist` folder or connect the repo and set build to `npm run build` and publish `dist`.
- **Your own server or CDN**: copy `dist/assets/index-*.js` and serve it at a stable URL.

You’ll use this full URL in Squarespace (e.g. `https://yourusername.github.io/squarespace-map-plugin/assets/index-XXXXXXXX.js`). If you use a fixed path like `/map-plugin.js`, you can rename the built file for convenience.

---

## 4. Add the Map to Squarespace

### 4.1 Add a Code Block

1. Edit the page where the map should appear.
2. Add a **Code** block.
3. Paste the following, then replace the placeholders:

```html
<div id="sqs-map-container" style="width: 100%; height: 480px;"></div>

<script>
  window.MapPluginConfig = {
    sheetId: "YOUR_SHEET_ID",
    apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
    mapContainerId: "sqs-map-container",
    zoomLevel: 10
  };
</script>
<script src="https://YOUR-HOSTED-URL/plugin.js" defer></script>
```

Replace:

- **`YOUR_SHEET_ID`** — The Sheet ID from step 1.3 (e.g. `1ABC123xyz`).
- **`YOUR_GOOGLE_MAPS_API_KEY`** — Your Maps API key from step 2.2.
- **`https://YOUR-HOSTED-URL/plugin.js`** — The full URL to your hosted `index-XXXXXXXX.js` (or renamed) file.

You can change:

- **`sqs-map-container`** — Any unique ID, as long as `mapContainerId` in the config matches the `id` of the div.
- **`zoomLevel`** — A number from 0–22 (default is 10 if omitted).
- **Height** — e.g. `height: 480px` to fit your layout.

### 4.2 Optional: Use a custom Map ID (recommended for new maps)

To use [Cloud-based map styling](https://developers.google.com/maps/documentation/javascript/get-map-id) and the newer **Advanced Markers**:

1. In [Google Cloud Console](https://console.cloud.google.com/): **Google Maps Platform → Map Management**.
2. Create a map with the style you want and copy its **Map ID**.
3. Add it to your config:

```html
<script>
  window.MapPluginConfig = {
    sheetId: "YOUR_SHEET_ID",
    apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
    mapContainerId: "sqs-map-container",
    zoomLevel: 10,
    mapId: "YOUR_MAP_ID"
  };
</script>
```

If you omit `mapId`, the plugin falls back to the legacy map type and standard markers.

### 4.3 Config reference

| Property          | Required | Description |
|-------------------|----------|-------------|
| `sheetId`         | Yes      | Google Sheet ID (from the sheet URL). |
| `apiKey`          | Yes      | Google Maps JavaScript API key. |
| `mapContainerId`  | Yes      | HTML `id` of the div where the map is drawn. |
| `zoomLevel`       | No       | Initial zoom (0–22). Default: `10`. |
| `mapId`           | No       | Map ID for Cloud-based styling and Advanced Markers. |

**Important:** `window.MapPluginConfig` must be defined **before** the script tag that loads the plugin. Keep the config `<script>` block above the `<script src="...">` tag.

---

## 5. Using Code Injection (site-wide script)

If you prefer to inject the script once for the whole site:

1. In Squarespace: **Settings → Advanced → Code Injection**.
2. In **Header** (or **Footer**), add the config and script. You still need a **Code Block** on each page where the map should appear, containing only the div:

**Code Injection (Header):**

```html
<script>
  window.MapPluginConfig = {
    sheetId: "YOUR_SHEET_ID",
    apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
    mapContainerId: "sqs-map-container",
    zoomLevel: 10
  };
</script>
<script src="https://YOUR-HOSTED-URL/plugin.js" defer></script>
```

**On each map page:** add a Code Block with:

```html
<div id="sqs-map-container" style="width: 100%; height: 480px;"></div>
```

If you use Code Injection, use one consistent `mapContainerId` (e.g. `sqs-map-container`) and only one map per page with that ID.

---

## Troubleshooting

- **“MapPluginConfig is not defined”**  
  Define `window.MapPluginConfig` in a `<script>` block that runs *before* the plugin script.

- **“Map container element #… not found”**  
  The div’s `id` must match `mapContainerId` exactly (e.g. `sqs-map-container`).

- **Map or markers don’t load**  
  - Check the browser console for errors.  
  - Confirm the Sheet is **published to the web** (File → Share → Publish to web).  
  - Confirm the Maps JavaScript API (and Geocoding API if using addresses) are enabled and the API key is valid and not restricted in a way that blocks your Squarespace domain.

- **Addresses not showing on the map**  
  Geocoding is used when a row has **Address** but no Latitude/Longitude. Ensure **Geocoding API** is enabled and the key has access. Results are cached in the browser for 7 days.

- **Blank or wrong map**  
  Ensure the sheet has at least one valid row: **Name** plus either **Latitude & Longitude** or **Address**. Column headers must match exactly (e.g. `Name`, `Latitude`, `Longitude`, `Address`, `Description`, `LinkURL`, `LinkText`).

---

## Development

- **Local dev:** `npm run dev` — use `index.html` and set `sheetId` and `apiKey` in the inline config there.  
- **Build:** `npm run build` — output in `dist/`.  
- **Preview build:** `npm run preview` — serve `dist/` locally.

---

## License

Use and modify as you like. Google Maps and Google Sheets are subject to [Google’s terms and policies](https://developers.google.com/terms).
