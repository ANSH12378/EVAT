# Congestion Prediction Service

This service provides EV charging station congestion predictions using the existing RandomForest regression model and FastAPI inference pipeline.

## Model

The service uses a RandomForestRegressor with:

- 175 trees
- Maximum depth of 15
- 23 input features
- 3-hour EV arrival prediction horizon
- Congestion output mapped to low, medium, or high

The optimized model preserves the same feature interface and prediction API used by the existing congestion prediction pipeline.

## Efficiency Optimisation

The original Random Forest configuration used 300 trees. Multiple tree-count configurations were benchmarked using the same training split, feature set, sample weighting, and model parameters.

The 175-tree configuration was selected as an efficiency/performance trade-off, reducing model size and training time while maintaining comparable predictive performance.

| Metric | Existing Model | Optimized Model |
|---|---:|---:|
| Trees | 300 | 175 |
| Training time | 0.1037 s | 0.0645 s |
| Inference time | 0.01308 s | 0.01338 s |
| Model artifact size | 725.25 KB | 423.14 KB |
| R² | 0.9113 | 0.9139 |
| RMSE | 0.4837 | 0.4766 |
| MAE | 0.1840 | 0.1877 |
| WAPE | 11.69% | 11.93% |

This represents:

- 41.67% fewer trees
- approximately 37.79% faster training in the controlled benchmark
- approximately 41.66% smaller model artifact in the benchmark
- comparable predictive performance, with slightly improved R² and RMSE but slightly higher MAE and WAPE
- similar inference time in this benchmark; the 175-tree model was slightly slower (0.01338 s compared with 0.01308 s)

The inference timing measures Random Forest model prediction time only and does not represent total end-to-end API latency, which also depends on external data sources and feature generation.

## Files

- `model_api.py` - FastAPI inference service
- `random_forest_model.pkl` - optimized 175-tree Random Forest model
- `EVAT.chargers.csv` - charging station coordinate data
- `requirements.txt` - Python dependencies
- `rf_efficiency_benchmark_results.csv` - benchmark results

### Optimization evidence

The optimized 175-tree model was selected through controlled Random Forest
benchmarking against the original 300-tree model using the project training
dataset.

`rf_efficiency_benchmark_results.csv` contains the recorded benchmark results
used during this optimization. The original training dataset and experimental
benchmark scripts are not packaged with the runtime service.

## Running the Service

Install dependencies:

```bash
pip install -r requirements.txt