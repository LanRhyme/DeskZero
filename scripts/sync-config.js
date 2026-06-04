import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const configPath = path.join(rootDir, "deskzero.config.json");
const packageJsonPath = path.join(rootDir, "package.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");

try {
	const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
	const version = config.version;

	if (!version) throw new Error("Version not found in deskzero.config.json");

	// Update package.json
	const packageData = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
	if (packageData.version !== version) {
		packageData.version = version;
		fs.writeFileSync(
			packageJsonPath,
			JSON.stringify(packageData, null, 2) + "\n",
		);
		console.log(`\x1b[32m✔\x1b[0m Synced package.json version to ${version}`);
	}

	// Update Cargo.toml
	const cargoData = fs.readFileSync(cargoTomlPath, "utf8");
	const newCargoData = cargoData.replace(
		/(\[package\][\s\S]*?version\s*=\s*")[^"]+(")/,
		`$1${version}$2`,
	);
	if (cargoData !== newCargoData) {
		fs.writeFileSync(cargoTomlPath, newCargoData);
		console.log(
			`\x1b[32m✔\x1b[0m Synced src-tauri/Cargo.toml version to ${version}`,
		);
	}
} catch (error) {
	console.error("Failed to sync configuration:", error);
	process.exit(1);
}
