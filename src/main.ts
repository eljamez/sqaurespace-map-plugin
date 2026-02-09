/**
 * Squarespace Map Plugin
 * Fetches location data from a published Google Sheet (CSV) and renders markers on a Google Map.
 * Configure via window.MapPluginConfig before the script runs.
 */
/// <reference types="google.maps" />

import Papa from "papaparse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    MapPluginConfig?: MapPluginConfig;
  }
}

export interface MapPluginConfig {
  sheetId: string;
  apiKey: string;
  mapContainerId: string;
  zoomLevel: number;
  /** Optional. Required for AdvancedMarkerElement; omit to use legacy Marker. */
  mapId?: string;
}

/** Parsed row from the sheet (columns: Name, Latitude, Longitude, Address?, Description, LinkURL, LinkText). */
export interface LocationRow {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  linkUrl: string;
  linkText: string;
}

/** Row parsed from CSV that only has an address and needs geocoding. */
interface RowNeedingGeocode {
  name: string;
  address: string;
  description: string;
  linkUrl: string;
  linkText: string;
}

const GEOCODE_CACHE_KEY = "mapPluginGeocodeCache";
const GEOCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** CSV URL for a sheet published to the web (File → Share → Publish to web). */
function getCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv`;
}

interface ParseLocationsResult {
  withCoords: LocationRow[];
  needsGeocode: RowNeedingGeocode[];
}

function parseLocations(csvText: string): ParseLocationsResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    console.warn("[MapPlugin] CSV parse warnings:", result.errors);
  }

  const withCoords: LocationRow[] = [];
  const needsGeocode: RowNeedingGeocode[] = [];

  for (const raw of result.data) {
    const name = (raw["Name"] ?? "").trim();
    const latRaw = (raw["Latitude"] ?? "").trim();
    const lngRaw = (raw["Longitude"] ?? "").trim();
    const address = (raw["Address"] ?? "").trim();
    const latitude = Number.parseFloat(latRaw);
    const longitude = Number.parseFloat(lngRaw);

    if (!name) {
      console.warn("[MapPlugin] Skipping row with missing name:", raw);
      continue;
    }

    const hasCoords = !Number.isNaN(latitude) && !Number.isNaN(longitude);
    if (hasCoords) {
      withCoords.push({
        name,
        latitude,
        longitude,
        description: (raw["Description"] ?? "").trim(),
        linkUrl: (raw["LinkURL"] ?? "").trim(),
        linkText: (raw["LinkText"] ?? "").trim(),
      });
      continue;
    }

    if (address) {
      needsGeocode.push({
        name,
        address,
        description: (raw["Description"] ?? "").trim(),
        linkUrl: (raw["LinkURL"] ?? "").trim(),
        linkText: (raw["LinkText"] ?? "").trim(),
      });
      continue;
    }

    console.warn("[MapPlugin] Skipping row with no coordinates or address:", raw);
  }

  return { withCoords, needsGeocode };
}

/** In-memory + localStorage cache for geocode results (avoids repeated API calls). */
function getGeocodeCache(): Record<string, { lat: number; lng: number; ts: number }> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { lat: number; lng: number; ts: number }>;
    const now = Date.now();
    const out: Record<string, { lat: number; lng: number; ts: number }> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value.lat === "number" && typeof value.lng === "number" && value.ts && now - value.ts < GEOCODE_CACHE_TTL_MS) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function setGeocodeCacheEntry(
  cache: Record<string, { lat: number; lng: number; ts: number }>,
  address: string,
  lat: number,
  lng: number
): void {
  const key = address.trim().toLowerCase();
  cache[key] = { lat, lng, ts: Date.now() };
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota or disabled localStorage
  }
}

function cacheKey(address: string): string {
  return address.trim().toLowerCase();
}

/** Geocode a single address; uses cache when available. Requires Maps API already loaded. */
async function geocodeAddress(
  address: string,
  cache: Record<string, { lat: number; lng: number; ts: number }>
): Promise<{ lat: number; lng: number } | null> {
  const key = cacheKey(address);
  const cached = cache[key];
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      const loc = results[0].geometry?.location;
      if (!loc) {
        resolve(null);
        return;
      }
      const lat = loc.lat();
      const lng = loc.lng();
      setGeocodeCacheEntry(cache, address, lat, lng);
      resolve({ lat, lng });
    });
  });
}

/** Resolve rows that only have an address into LocationRow[] via geocoding (with cache). */
async function resolveAddressRows(
  rows: RowNeedingGeocode[],
  cache: Record<string, { lat: number; lng: number; ts: number }>
): Promise<LocationRow[]> {
  const resolved: LocationRow[] = [];
  for (const row of rows) {
    const coords = await geocodeAddress(row.address, cache);
    if (!coords) {
      console.warn("[MapPlugin] Geocoding failed for address:", row.address, "(", row.name, ")");
      continue;
    }
    resolved.push({
      name: row.name,
      latitude: coords.lat,
      longitude: coords.lng,
      description: row.description,
      linkUrl: row.linkUrl,
      linkText: row.linkText,
    });
  }
  return resolved;
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof (window as unknown as { google?: { maps: unknown } }).google !== "undefined") {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src^="https://maps.googleapis.com/maps/api/js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed to load")));
      return;
    }

    const callbackName = "mapPluginMapsCallback";
    (window as unknown as Record<string, () => void>)[callbackName] = () => resolve();

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      reject(new Error("Failed to load Google Maps JavaScript API"));
    });
    document.head.appendChild(script);
  });
}

function buildInfoWindowContent(loc: LocationRow): string {
  const safeName = escapeHtml(loc.name);
  const safeDesc = escapeHtml(loc.description);
  const safeLinkText = loc.linkText ? escapeHtml(loc.linkText) : "Learn more";
  const hasLink = loc.linkUrl && /^https?:\/\//i.test(loc.linkUrl);
  const linkHtml = hasLink
    ? `<a href="${escapeHtml(loc.linkUrl)}" target="_blank" rel="noopener noreferrer">${safeLinkText}</a>`
    : "";

  return [
    `<h3 class="map-plugin-info-title">${safeName}</h3>`,
    safeDesc ? `<p class="map-plugin-info-desc">${safeDesc}</p>` : "",
    linkHtml ? `<p class="map-plugin-info-link">${linkHtml}</p>` : "",
  ]
    .filter(Boolean)
    .join("");
}

// ---------------------------------------------------------------------------
// Map initialization (uses AdvancedMarkerElement when available)
// ---------------------------------------------------------------------------

async function initMap(
  container: HTMLElement,
  locations: LocationRow[],
  zoomLevel: number,
  apiKey: string,
  mapId?: string
): Promise<void> {
  await loadGoogleMapsScript(apiKey);

  const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;

  const mapOptions: google.maps.MapOptions = {
    zoom: zoomLevel,
    center: locations.length
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : { lat: 0, lng: 0 },
  };
  if (mapId) mapOptions.mapId = mapId;

  const map = new Map(container, mapOptions);

  const infoWindow = new google.maps.InfoWindow();
  const bounds = new google.maps.LatLngBounds();

  const useAdvancedMarkers = Boolean(mapId);
  let AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement | null = null;
  if (useAdvancedMarkers) {
    const markerLib = (await google.maps.importLibrary(
      "marker"
    )) as google.maps.MarkerLibrary;
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
  }

  for (const loc of locations) {
    const position = { lat: loc.latitude, lng: loc.longitude };
    bounds.extend(position);

    const marker = useAdvancedMarkers && AdvancedMarkerElement
      ? new AdvancedMarkerElement({ map, position, title: loc.name })
      : new google.maps.Marker({ map, position, title: loc.name });

    marker.addListener("click", () => {
      const content = buildInfoWindowContent(loc);
      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });
  }

  if (locations.length > 1) {
    map.fitBounds(bounds);
  } else if (locations.length === 1) {
    map.setCenter({ lat: locations[0].latitude, lng: locations[0].longitude });
    map.setZoom(zoomLevel);
  }
}

// ---------------------------------------------------------------------------
// Main entry (IIFE-style init, no globals except config)
// ---------------------------------------------------------------------------

function run(): void {
  const config = window.MapPluginConfig;
  if (!config) {
    console.error("[MapPlugin] window.MapPluginConfig is not defined.");
    return;
  }

  const { sheetId, apiKey, mapContainerId, zoomLevel } = config;
  if (!sheetId || !apiKey || !mapContainerId) {
    console.error(
      "[MapPlugin] MapPluginConfig must include sheetId, apiKey, and mapContainerId."
    );
    return;
  }

  const container = document.getElementById(mapContainerId);
  if (!container) {
    console.error(`[MapPlugin] Map container element #${mapContainerId} not found.`);
    return;
  }

  const zoom = typeof zoomLevel === "number" && zoomLevel >= 0 && zoomLevel <= 22 ? zoomLevel : 10;
  const mapId = config.mapId;
  const csvUrl = getCsvUrl(sheetId);

  container.innerHTML = "<p class=\"map-plugin-loading\">Loading map…</p>";

  fetch(csvUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.text();
    })
    .then(async (text) => {
      const { withCoords, needsGeocode } = parseLocations(text);
      if (withCoords.length === 0 && needsGeocode.length === 0) {
        container.innerHTML =
          "<p class=\"map-plugin-error\">No valid locations found (need Name + Latitude/Longitude or Address).</p>";
        return;
      }

      await loadGoogleMapsScript(apiKey);

      let allLocations: LocationRow[] = [...withCoords];
      if (needsGeocode.length > 0) {
        const cache = getGeocodeCache();
        const resolved = await resolveAddressRows(needsGeocode, cache);
        allLocations = allLocations.concat(resolved);
      }

      if (allLocations.length === 0) {
        container.innerHTML =
          "<p class=\"map-plugin-error\">No valid locations found in the sheet.</p>";
        return;
      }

      container.innerHTML = "";
      return initMap(container, allLocations, zoom, apiKey, mapId);
    })
    .catch((err) => {
      console.error("[MapPlugin]", err);
      container.innerHTML =
        "<p class=\"map-plugin-error\">Unable to load map. Check the console for details.</p>";
    });
}

// Run when DOM is ready; also support Squarespace AJAX navigation if present.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}

// Re-run on Squarespace full page / AJAX navigation (optional)
document.addEventListener("mercury:load", run);
document.addEventListener("SQS_PAGE_CHANGED", run);
