import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "./user";
import { getNearbyPlaces, getPlacesForStation } from "../services/nearbyPlaceService";

export const NearbyPlacesContext = createContext({
  station: null,
  places: [],
  loading: false,
  error: "",
});

function stationCoords(station) {
  const latitude = Number(station?.latitude ?? station?.location?.coordinates?.[1]);
  const longitude = Number(station?.longitude ?? station?.location?.coordinates?.[0]);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Single fetch for the selected charger (category=all).
 * Sidebar and map markers both consume this so we don't double-hit Google Places.
 */
export function NearbyPlacesProvider({ station, children }) {
  const { user } = useContext(UserContext);
  const token = user?.token;
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!station || !token) {
      setPlaces([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const loadPlaces = async () => {
      setLoading(true);
      setError("");
      try {
        const options = {
          category: "all",
          radiusKm: 1,
          token,
          signal: abortController.signal,
        };

        let response;
        if (station._id) {
          response = await getPlacesForStation(station._id, options);
        } else {
          const coords = stationCoords(station);
          if (!coords) {
            throw new Error("This station has no location data.");
          }
          response = await getNearbyPlaces(coords.latitude, coords.longitude, options);
        }

        if (cancelled) return;
        setPlaces(response.data?.places || []);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setPlaces([]);
        setError(err.message || "Unable to load nearby places.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlaces();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [station, token]);

  const value = useMemo(
    () => ({ station, places, loading, error }),
    [station, places, loading, error]
  );

  return (
    <NearbyPlacesContext.Provider value={value}>
      {children}
    </NearbyPlacesContext.Provider>
  );
}

export function useNearbyPlaces() {
  return useContext(NearbyPlacesContext);
}
