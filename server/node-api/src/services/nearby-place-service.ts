import axios from "axios";
import ChargingStationRepository from "../repositories/station-repository";
import GoogleNearbyPlacesService, {
  NearbyPlace,
  haversineMeters,
  buildWalkingDirectionsUrl,
} from "./google-nearby-places-service";
import TtlCache from "../utils/ttl-cache";

const DEFAULT_RADIUS_KM = 1;
const MAX_RADIUS_KM = 3;
const METERS_PER_WALKING_MINUTE = 80;

/** Places results stay fresh for ~10 minutes to cut repeat Google Calls. */
const PLACES_CACHE_TTL_MS = 10 * 60 * 1000;
const PHOTO_CACHE_TTL_MS = 10 * 60 * 1000;
const PLACES_CACHE_MAX = 200;
const PHOTO_CACHE_MAX = 80;

function stationCoordinates(station: {
  latitude?: number;
  longitude?: number;
  location?: { coordinates?: [number, number] };
}): { latitude: number; longitude: number } | null {
  const latitude = station.latitude ?? station.location?.coordinates?.[1];
  const longitude = station.longitude ?? station.location?.coordinates?.[0];
  if (latitude == null || longitude == null || Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
    return null;
  }
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function normalizeCategory(category?: string): string {
  return (category || "all").toLowerCase().trim() || "all";
}

function placesCacheKey(
  latitude: number,
  longitude: number,
  radiusKm: number,
  category: string
): string {
  // Rounded key only buckets the expensive Google lookup. Origin-dependent
  // fields are recomputed per request from the exact coordinates.
  return `places:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${radiusKm}:${category}`;
}

function stationCacheKey(
  stationId: string,
  radiusKm: number,
  category: string
): string {
  return `station:${stationId}:${radiusKm}:${category}`;
}

/**
 * Recompute distance / walk time / directions for the exact request origin.
 * Cached Google payloads may have been measured from a nearby rounded origin.
 */
export function withRequestOrigin(
  places: NearbyPlace[],
  originLat: number,
  originLng: number
): NearbyPlace[] {
  return places
    .map((place) => {
      const placeLat = Number(place.latitude);
      const placeLng = Number(place.longitude);
      if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) {
        return { ...place };
      }

      const distanceMeters = Math.round(
        haversineMeters(originLat, originLng, placeLat, placeLng)
      );

      return {
        ...place,
        latitude: placeLat,
        longitude: placeLng,
        distanceMeters,
        walkingMinutes: Math.max(
          1,
          Math.round(distanceMeters / METERS_PER_WALKING_MINUTE)
        ),
        directionsUrl: buildWalkingDirectionsUrl(
          originLat,
          originLng,
          placeLat,
          placeLng
        ),
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export default class NearbyPlaceService {
  private readonly placesCache = new TtlCache<NearbyPlace[]>(
    PLACES_CACHE_TTL_MS,
    PLACES_CACHE_MAX
  );
  private readonly photoCache = new TtlCache<{ bytes: Buffer; contentType: string }>(
    PHOTO_CACHE_TTL_MS,
    PHOTO_CACHE_MAX
  );
  /** Coalesce concurrent cache misses so parallel callers share one Google request. */
  private readonly inFlightPlaces = new Map<string, Promise<NearbyPlace[]>>();
  private readonly inFlightPhotos = new Map<
    string,
    Promise<{ bytes: Buffer; contentType: string }>
  >();

  /** Test helper — clears in-memory caches. */
  clearCaches(): void {
    this.placesCache.clear();
    this.photoCache.clear();
    this.inFlightPlaces.clear();
    this.inFlightPhotos.clear();
  }

  private validateCoordinates(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("latitude and longitude are required");
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error("latitude must be between -90 and 90");
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error("longitude must be between -180 and 180");
    }
  }

  private resolveRadiusKm(radiusKm?: number): number {
    const radius = radiusKm == null ? DEFAULT_RADIUS_KM : Number(radiusKm);
    if (Number.isNaN(radius) || radius <= 0) {
      throw new Error("radiusKm must be a number greater than 0");
    }
    return Math.min(radius, MAX_RADIUS_KM);
  }

  private async loadPlacesOnce(
    cacheKey: string,
    loader: () => Promise<NearbyPlace[]>
  ): Promise<NearbyPlace[]> {
    const cached = this.placesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const existing = this.inFlightPlaces.get(cacheKey);
    if (existing) {
      return existing;
    }

    const pending = loader()
      .then((places) => {
        this.placesCache.set(cacheKey, places);
        return places;
      })
      .finally(() => {
        this.inFlightPlaces.delete(cacheKey);
      });

    this.inFlightPlaces.set(cacheKey, pending);
    return pending;
  }

  async getNearbyPlaces(
    latitude: number,
    longitude: number,
    radiusKm?: number,
    category?: string
  ): Promise<NearbyPlace[]> {
    this.validateCoordinates(latitude, longitude);
    const radius = this.resolveRadiusKm(radiusKm);
    const normalizedCategory = normalizeCategory(category);
    const cacheKey = placesCacheKey(latitude, longitude, radius, normalizedCategory);

    const places = await this.loadPlacesOnce(cacheKey, () =>
      GoogleNearbyPlacesService.findNearbyPlaces(
        latitude,
        longitude,
        radius * 1000,
        normalizedCategory
      )
    );

    return withRequestOrigin(places, latitude, longitude);
  }

  async getNearbyForStation(
    stationId: string,
    radiusKm?: number,
    category?: string
  ): Promise<NearbyPlace[]> {
    if (!stationId) {
      throw new Error("Station ID is required");
    }

    const radius = this.resolveRadiusKm(radiusKm);
    const normalizedCategory = normalizeCategory(category);
    const cacheKey = stationCacheKey(stationId, radius, normalizedCategory);

    return this.loadPlacesOnce(cacheKey, async () => {
      const station = await ChargingStationRepository.findById(stationId);
      if (!station) {
        throw new Error("Charging station not found");
      }

      const coords = stationCoordinates(station);
      if (!coords) {
        throw new Error("Station location is unavailable");
      }

      // Reuse the coords-keyed path so lat/lon and station callers share Google results.
      // getNearbyPlaces remaps distances/directions to this station's exact coords.
      return this.getNearbyPlaces(
        coords.latitude,
        coords.longitude,
        radius,
        normalizedCategory
      );
    });
  }

  async getPhotoUri(photoName: string): Promise<string> {
    if (!photoName) {
      throw new Error("Photo name is required");
    }
    return GoogleNearbyPlacesService.getPhotoUri(photoName);
  }

  async getPhoto(
    photoName: string
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const cached = this.photoCache.get(photoName);
    if (cached) {
      return cached;
    }

    const existing = this.inFlightPhotos.get(photoName);
    if (existing) {
      return existing;
    }

    const pending = (async () => {
      const photoUri = await this.getPhotoUri(photoName);
      const response = await axios.get(photoUri, {
        responseType: "arraybuffer",
        timeout: 8000,
      });
      const photo = {
        bytes: Buffer.from(response.data),
        contentType: String(response.headers["content-type"] || "image/jpeg"),
      };
      this.photoCache.set(photoName, photo);
      return photo;
    })().finally(() => {
      this.inFlightPhotos.delete(photoName);
    });

    this.inFlightPhotos.set(photoName, pending);
    return pending;
  }
}
