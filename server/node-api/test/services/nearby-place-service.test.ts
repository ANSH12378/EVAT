import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import NearbyPlaceService from "../../src/services/nearby-place-service";
import ChargingStationRepository from "../../src/repositories/station-repository";
import GoogleNearbyPlacesService, {
  buildWalkingDirectionsUrl,
} from "../../src/services/google-nearby-places-service";
import axios from "axios";

jest.mock("axios");
jest.mock("../../src/services/google-nearby-places-service", () => {
  const actual = jest.requireActual(
    "../../src/services/google-nearby-places-service"
  ) as object;
  return {
    ...actual,
    __esModule: true,
    default: {
      findNearbyPlaces: jest.fn(),
      getPhotoUri: jest.fn(),
    },
  };
});
jest.mock("../../src/repositories/station-repository");

describe("nearby-place-service", () => {
  let service: NearbyPlaceService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new NearbyPlaceService();
  });

  describe("getNearbyPlaces", () => {
    test("Case: Calls Google Places with charger coordinates", async () => {
      const places = [
        {
          id: "1",
          name: "Local Cafe",
          latitude: -37.814,
          longitude: 144.964,
          distanceMeters: 999,
          walkingMinutes: 99,
          directionsUrl: "stale",
        },
      ];
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockResolvedValue(places);

      const result = await service.getNearbyPlaces(-37.8136, 144.9631, 1, "food");

      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledWith(
        -37.8136,
        144.9631,
        1000,
        "food"
      );
      expect(result).toHaveLength(1);
      expect(result[0].directionsUrl).toBe(
        buildWalkingDirectionsUrl(-37.8136, 144.9631, -37.814, 144.964)
      );
      expect(result[0].distanceMeters).not.toBe(999);
    });

    test("Case: Serves a cached response for the same location and category", async () => {
      const places = [
        {
          id: "1",
          name: "Local Cafe",
          latitude: -37.814,
          longitude: 144.964,
          distanceMeters: 120,
          walkingMinutes: 2,
          directionsUrl: "stale",
        },
      ];
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockResolvedValue(places);

      const first = await service.getNearbyPlaces(-37.8136, 144.9631, 1, "food");
      const second = await service.getNearbyPlaces(-37.8136, 144.9631, 1, "food");

      expect(first[0].id).toBe("1");
      expect(second[0].id).toBe("1");
      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledTimes(1);
    });

    test("Case: Recomputes directions for a nearby origin that shares the rounded cache key", async () => {
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockResolvedValue([
        {
          id: "1",
          name: "Local Cafe",
          latitude: -37.814,
          longitude: 144.964,
          distanceMeters: 1,
          walkingMinutes: 1,
          directionsUrl: "from-first-origin",
        },
      ]);

      // These round to the same 4-decimal bucket but are not identical.
      const firstOrigin = { lat: -37.81361, lng: 144.96311 };
      const secondOrigin = { lat: -37.81364, lng: 144.96314 };

      const first = await service.getNearbyPlaces(
        firstOrigin.lat,
        firstOrigin.lng,
        1,
        "food"
      );
      const second = await service.getNearbyPlaces(
        secondOrigin.lat,
        secondOrigin.lng,
        1,
        "food"
      );

      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledTimes(1);
      expect(first[0].directionsUrl).toBe(
        buildWalkingDirectionsUrl(
          firstOrigin.lat,
          firstOrigin.lng,
          -37.814,
          144.964
        )
      );
      expect(second[0].directionsUrl).toBe(
        buildWalkingDirectionsUrl(
          secondOrigin.lat,
          secondOrigin.lng,
          -37.814,
          144.964
        )
      );
      expect(second[0].directionsUrl).not.toBe(first[0].directionsUrl);
    });

    test("Case: Does not reuse cache across different categories", async () => {
      (GoogleNearbyPlacesService.findNearbyPlaces as any)
        .mockResolvedValueOnce([{ id: "food", latitude: -37.81, longitude: 144.96 }])
        .mockResolvedValueOnce([{ id: "shop", latitude: -37.81, longitude: 144.96 }]);

      await service.getNearbyPlaces(-37.8136, 144.9631, 1, "food");
      await service.getNearbyPlaces(-37.8136, 144.9631, 1, "shopping");

      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledTimes(2);
    });

    test("Case: Coalesces concurrent cache misses into one Google call", async () => {
      let resolvePlaces: (value: any) => void = () => undefined;
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePlaces = resolve;
          })
      );

      const first = service.getNearbyPlaces(-37.8136, 144.9631, 1, "all");
      const second = service.getNearbyPlaces(-37.8136, 144.9631, 1, "all");
      resolvePlaces([{ id: "shared", latitude: -37.814, longitude: 144.964 }]);

      const [a, b] = await Promise.all([first, second]);
      expect(a[0].id).toBe("shared");
      expect(b[0].id).toBe("shared");
      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledTimes(1);
    });

    test("Case: Rejects invalid coordinates", async () => {
      await expect(service.getNearbyPlaces(200, 144.96)).rejects.toThrow(
        "latitude must be between -90 and 90"
      );
    });
  });

  describe("getNearbyForStation", () => {
    test("Case: Looks up the station then searches nearby places", async () => {
      (ChargingStationRepository.findById as any).mockResolvedValue({
        latitude: -37.8136,
        longitude: 144.9631,
      });
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockResolvedValue([
        { id: "mall", name: "Melbourne Central", latitude: -37.81, longitude: 144.96 },
      ]);

      const result = await service.getNearbyForStation("station123", undefined, "shopping");

      expect(ChargingStationRepository.findById).toHaveBeenCalledWith("station123");
      expect(result).toHaveLength(1);
    });

    test("Case: Caches by station id so reopen skips Google and DB", async () => {
      (ChargingStationRepository.findById as any).mockResolvedValue({
        latitude: -37.8136,
        longitude: 144.9631,
      });
      (GoogleNearbyPlacesService.findNearbyPlaces as any).mockResolvedValue([
        { id: "mall", name: "Melbourne Central", latitude: -37.81, longitude: 144.96 },
      ]);

      await service.getNearbyForStation("station123", 1, "shopping");
      await service.getNearbyForStation("station123", 1, "shopping");

      expect(ChargingStationRepository.findById).toHaveBeenCalledTimes(1);
      expect(GoogleNearbyPlacesService.findNearbyPlaces).toHaveBeenCalledTimes(1);
    });

    test("Case: Throws when the station does not exist", async () => {
      (ChargingStationRepository.findById as any).mockResolvedValue(null);

      await expect(service.getNearbyForStation("missing")).rejects.toThrow(
        "Charging station not found"
      );
    });
  });

  describe("getPhotoUri", () => {
    test("Case: Asks Google Places for the photo URI", async () => {
      (GoogleNearbyPlacesService.getPhotoUri as any).mockResolvedValue(
        "https://lh3.googleusercontent.com/photo"
      );

      const result = await service.getPhotoUri("places/ChIJ123/photos/abc");

      expect(GoogleNearbyPlacesService.getPhotoUri).toHaveBeenCalledWith(
        "places/ChIJ123/photos/abc"
      );
      expect(result).toBe("https://lh3.googleusercontent.com/photo");
    });
  });

  describe("getPhoto", () => {
    test("Case: Downloads photo bytes from the Google photo URI", async () => {
      (GoogleNearbyPlacesService.getPhotoUri as any).mockResolvedValue(
        "https://lh3.googleusercontent.com/photo"
      );
      (axios.get as any).mockResolvedValue({
        data: Buffer.from("img"),
        headers: { "content-type": "image/jpeg" },
      });

      const result = await service.getPhoto("places/ChIJ123/photos/abc");

      expect(axios.get).toHaveBeenCalledWith("https://lh3.googleusercontent.com/photo", {
        responseType: "arraybuffer",
        timeout: 8000,
      });
      expect(result.contentType).toBe("image/jpeg");
      expect(Buffer.isBuffer(result.bytes)).toBe(true);
    });

    test("Case: Serves a cached photo without calling Google again", async () => {
      (GoogleNearbyPlacesService.getPhotoUri as any).mockResolvedValue(
        "https://lh3.googleusercontent.com/photo"
      );
      (axios.get as any).mockResolvedValue({
        data: Buffer.from("img"),
        headers: { "content-type": "image/jpeg" },
      });

      await service.getPhoto("places/ChIJ123/photos/abc");
      await service.getPhoto("places/ChIJ123/photos/abc");

      expect(GoogleNearbyPlacesService.getPhotoUri).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });
});
