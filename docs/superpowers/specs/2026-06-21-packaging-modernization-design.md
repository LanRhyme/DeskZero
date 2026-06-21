# 规格设计：DeskZero 桌面打包器路径 Bug 彻底修复与 Inno Setup 方案

## 1. 背景与现状

在之前的版本迭代中，由于 NSIS 的选择目录页面存在逻辑缺陷（切换盘符后路径还原或重复拼接应用名称），曾尝试引入自定义的 NSIS 模板进行处理。然而：
1. 即使进行了修复，若检测到注册表有残留路径但文件夹不存在时，脚本仍然执行了 `StrCpy $INSTDIR "默认路径"` 作为 fallback。
2. 在 NSIS 中，**在 `.onInit` 中手动对 `$INSTDIR` 进行 `StrCpy` 赋值会将其标记为“用户/脚本已手动锁定”**。这会破坏 NSIS 目录选择页面的默认行为，导致点击 `Browse` 按钮选择其他盘符时，NSIS 无法正确追加应用名称，或者发生盘符回退至默认盘符（C 盘）以及路径重复拼接。

本规格书重新设计了两种解决方案：彻底移除 NSIS 的 fallback `StrCpy` 从而解除变量锁定，或者切换为 Inno Setup 脚本打包流程。

---

## 2. 方案设计对比

### 方案 A：彻底修复 NSIS 模板的 `$INSTDIR` 锁定（推荐）

*   **实现原理**：在 `.onInit` 中，如果检测到注册表中记录的路径已经不存在，我们**什么都不做，不进行任何赋值**。这样，NSIS 会保持编译期 `InstallDir` 声明的原始状态，Browse 页面表现完美正常。当用户选择其他盘符时，自动追加子文件夹（`\DeskZero`），且绝对不会发生回退或重复拼接。
*   **拟修改文件**：`src-tauri/nsis/installer.nsi` 和 `src-tauri/custom-installer.nsi` 的 `.onInit`。

### 方案 B：改用 Inno Setup 打包器

*   **实现原理**：通过编写 `.iss` 安装脚本文件，由 Inno Setup 命令行编译器 `iscc` 完成应用打包。
*   **具体步骤**：
    1.  运行 `npm run build` 和 `npx tauri build --bundles none` 编译前端和 Rust。
    2.  创建 `src-tauri/installer.iss` 并在其中声明源文件 `src-tauri/target/release/deskzero.exe`。
    3.  通过自定义打包脚本或 GitHub Actions 运行 `iscc.exe src-tauri/installer.iss` 构建最终安装程序。
*   **优缺点**：
    *   **优势**：Inno Setup 的路径管理（自动创建子目录、检测先前路径）在底层完全内聚，性能和体验非常稳定，不存在 NSIS 这种变量状态锁定的 Bug。
    *   **劣势**：脱离了 Tauri 官方 CLI 链条，并且对 Tauri 官方的 `updater` 自动升级模块的支持不够顺畅。

---

## 3. 拟修改细节

### 方案 A 的 `.onInit` 替换细节
```nsis
  ; 尝试从注册表读取先前路径
  !if "${INSTALLMODE}" == "perMachine"
    ReadRegStr $RegistryInstallDir HKLM "${MANUPRODUCTKEY}" ""
  !else
    ReadRegStr $RegistryInstallDir HKCU "${MANUPRODUCTKEY}" ""
  !endif

  ${If} $RegistryInstallDir != ""
    ; 仅在先前路径存在且磁盘文件夹确实存在时，才进行 StrCpy 覆盖
    ${If} ${FileExists} "$RegistryInstallDir\*.*"
      StrCpy $INSTDIR $RegistryInstallDir
    ${EndIf}
  ${EndIf}
```
通过这样移除 `Else` 分支，彻底清除了所有的 fallback `StrCpy` 行为，恢复了 Browse 按钮的默认逻辑。
