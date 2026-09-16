from occupancy_prediction.occupancy_prediction import predict


def test_predict_identifies_busy_and_off_peak_hours():
    result = predict(
        {
            "station_id": "station-1",
            "time": "15:00",
            "historical_occupancy": {
                "8": 1,
                "9": 1,
                "10": 1,
                "14": 4,
                "15": 4,
                "16": 4,
            },
        }
    )

    assert result["status"] == "success"
    assert result["station_id"] == "station-1"
    assert result["predicted_occupancy"] == 100.0
    assert result["busy_hours"] == [14, 15, 16]
    assert result["off_peak_hours"] == [8, 9, 10]
    assert "14:00-17:00" in result["recommendation"]
    assert "8:00-11:00" in result["recommendation"]


def test_predict_returns_low_confidence_for_empty_history():
    result = predict(
        {
            "station_id": "station-2",
            "historical_occupancy": {},
        }
    )

    assert result == {
        "status": "success",
        "station_id": "station-2",
        "predicted_occupancy": 0.0,
        "busy_hours": [],
        "off_peak_hours": [],
        "recommendation": "Insufficient historical data to predict occupancy.",
        "confidence": 0.0,
    }


def test_predict_returns_insufficient_data_for_zero_only_history():
    result = predict(
        {
            "station_id": "station-1",
            "historical_occupancy": {str(hour): 0 for hour in range(24)},
        }
    )

    assert result == {
        "status": "success",
        "station_id": "station-1",
        "predicted_occupancy": 0.0,
        "busy_hours": [],
        "off_peak_hours": [],
        "recommendation": "Insufficient historical data to predict occupancy.",
        "confidence": 0.0,
    }


def test_predict_confidence_uses_observed_hours_only():
    result = predict(
        {
            "station_id": "station-1",
            "historical_occupancy": {str(hour): 1 if hour < 3 else 0 for hour in range(24)},
        }
    )

    assert result["confidence"] == 0.12


def test_predict_uses_average_for_an_hour_without_history():
    result = predict(
        {
            "station_id": "station-3",
            "time": "12:00",
            "historical_occupancy": {"8": 2, "9": 4},
        }
    )

    assert result["predicted_occupancy"] == 75.0
    assert result["busy_hours"] == []


def test_predict_does_not_recommend_zero_filled_hours_as_off_peak():
    result = predict(
        {
            "station_id": "station-4",
            "historical_occupancy": {
                **{str(hour): 0 for hour in range(24)},
                "8": 1,
                "14": 4,
            },
        }
    )

    assert result["off_peak_hours"] == [8]
    assert 0 not in result["off_peak_hours"]
    assert 23 not in result["off_peak_hours"]
