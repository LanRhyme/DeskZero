import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const srcTauriDir = path.join(rootDir, "src-tauri");
const configPath = path.join(rootDir, "deskzero.config.json");

try {
	// 1. 读取版本号
	const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
	const version = config.version;
	if (!version) throw new Error("Version not found in deskzero.config.json");
	console.log(`[Inno Build] Found version ${version} from deskzero.config.json`);

	// 2. 编译前端和 Rust（不生成默认的 NSIS/MSI 安装包，以加快速度）
	console.log("[Inno Build] Running tauri build...");
	const env = {
		...process.env,
		CARGO_MANIFEST_DIR: srcTauriDir,
	};
	execSync("npx tauri build --no-bundle", {
		stdio: "inherit",
		cwd: rootDir,
		shell: true,
		env,
	});

	// 3. 运行 Inno Setup Compiler 编译安装包
	console.log("[Inno Build] Compiling Inno Setup installer...");
	const isccPath = "C:\\Program Files (x86)\\Inno Setup 6\\iscc.exe";
	const issPath = path.join(rootDir, "src-tauri", "installer.iss");
	const command = `"${isccPath}" /DMyAppVersion="${version}" "${issPath}"`;
	
	execSync(command, { stdio: "inherit", cwd: rootDir, shell: true });
	console.log("[Inno Build] Inno Setup installer compiled successfully!");
} catch (error) {
	console.error("[Inno Build] Build failed:", error);
	process.exit(1);
}
