# Tools

## Swappable Reducer Step

The reducer step lives in `tools/lib/reducers.js` and supports a simple setting-driven choice between PCA and UMAP.

Default settings are in `tools/reducer_config.json`:

```json
{
  "method": "pca",
  "dimensions": 20
}
```

Set `"method"` to `"umap"` to use UMAP without changing the rest of the pipeline.

Programmatic use:

```js
const { reduceFeatures } = require("./tools/lib/reducers");

const result = reduceFeatures(featureMatrix, {
  method: "pca",
  dimensions: 20
});
```

Command-line use with a saved numeric feature matrix:

```sh
npm run reduce -- --input=features.json --output=embedding.json --reducer=pca --dimensions=20
npm run reduce -- --input=features.json --output=embedding.json --reducer=umap --dimensions=20
```

PCA is the current default because it is the WP3 leader so far. UMAP remains supported behind the same setting until a larger benchmark locks the reducer decision.
