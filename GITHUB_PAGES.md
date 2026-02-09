# GitHub Pages setup

Use these steps so your landing page appears at **https://eljamez.github.io/&lt;repo-name&gt;/**.

## 1. Check your repo name

The site URL is **https://&lt;username&gt;.github.io/&lt;repo-name&gt;/**.

- If the repo is **sqaurespace-map-plugin** (with the typo), the URL is:  
  **https://eljamez.github.io/sqaurespace-map-plugin/**
- If the repo is **squarespace-map-plugin**, the URL is:  
  **https://eljamez.github.io/squarespace-map-plugin/**

Use the URL that matches your actual repo name.

## 2. Enable GitHub Pages

1. Open your repo on GitHub.
2. Go to **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source:** choose **Deploy from a branch**.
   - **Branch:** e.g. `main` (or the branch you use).
   - **Folder:** choose **/ (root)**.
4. Click **Save**.

The landing page is the **root `index.html`** in this repo, so deploying from the root will serve it.

## 3. Push and wait

- Ensure **index.html** (and the rest of the repo) is committed and pushed.
- After saving the Pages settings, GitHub will build and deploy. The first time can take 1–2 minutes.
- Visit **https://eljamez.github.io/&lt;repo-name&gt;/** (with your real repo name). You should see the Squarespace Map Plugin landing page.

## 4. Serve the plugin script from the same site

So the “Copy embed code” button uses a working script URL:

1. Run **`npm run build`** locally.
2. Copy the built script **`dist/assets/dev-XXXXXXXX.js`** (the hashed filename) to **`assets/map-plugin.js`** in the **root** of the repo (create the `assets` folder if needed).
3. Commit and push. The script will be at **https://eljamez.github.io/&lt;repo-name&gt;/assets/map-plugin.js**.

If you use the **docs** folder as the Pages source instead of root, put the landing in **docs/index.html** and the script at **docs/assets/map-plugin.js**; the repo already includes **docs/index.html** and **docs/.nojekyll** for that setup.

## If you still get 404

- Confirm **Settings → Pages** shows “GitHub Pages is currently being built from the **main** branch” (or your branch) and folder **/ (root)**.
- Check the **Actions** tab for a “pages build and deployment” workflow; if it failed, open it for errors.
- Wait a few minutes and try again; first deploy can be slow.
- Try a hard refresh or another browser in case of caching.
