const fs = require("fs");
const path = require("path");
const { reduceFeatures } = require("./lib/reducers");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(__dirname, "reducer_config.json");

function parseArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
      return [key, valueParts.join("=") || true];
    }),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    throw new Error("Usage: node tools/apply_reducer.js --input=<features.json> --output=<embedding.json> [--reducer=pca|umap] [--dimensions=20]");
  }

  const config = JSON.parse(fs.readFileSync(args.config ?? DEFAULT_CONFIG, "utf8"));
  if (args.reducer) config.method = args.reducer;
  if (args.dimensions) config.dimensions = Number(args.dimensions);
  if (args.seed) config.seed = Number(args.seed);

  const inputPath = path.resolve(ROOT, args.input);
  const outputPath = path.resolve(ROOT, args.output);
  const matrix = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const result = reduceFeatures(matrix, config);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        reducer: result.method,
        config,
        rows: matrix.length,
        input_dimensions: matrix[0].length,
        output_dimensions: result.embedding[0].length,
        details: result.details,
        embedding: result.embedding,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Wrote ${result.method} embedding to ${outputPath}`);
}

main();
