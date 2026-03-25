# ─── Productivity Engine — ILYTAT Suite ──────────────────────────────────────
# Convenience targets for development, building, and installation.
# Requires: Node.js, npm, Rust/Cargo, Tauri CLI

.DEFAULT_GOAL := help
.PHONY: help deps dev build install install-deb install-appimage clean lint typecheck test test-e2e release bump upgrade upgrade-minor upgrade-major icon

# Detect platform
UNAME := $(shell uname -s)

# ─── Help ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Productivity Engine — ILYTAT Suite"
	@echo ""
	@echo "  Usage: make <target>"
	@echo ""
	@echo "  Development"
	@echo "    deps              Install Node.js dependencies"
	@echo "    dev               Start Tauri dev server (hot reload)"
	@echo ""
	@echo "  Quality"
	@echo "    lint              Run ESLint"
	@echo "    typecheck         Run TypeScript type check (vue-tsc)"
	@echo "    test              Run unit tests (Vitest)"
	@echo "    test-e2e          Run end-to-end tests (Playwright)"
	@echo ""
	@echo "  Build & Install"
	@echo "    build             Build the desktop app bundle"
	@echo "    install           Build then install the .deb (Linux)"
	@echo "    install-deb       Install already-built .deb, no rebuild (Linux)"
	@echo "    install-appimage  Make AppImage executable and launch it (Linux)"
	@echo "    release           deps + lint + typecheck + build"
	@echo ""
	@echo "  Upgrade (bump version + build + install)"
	@echo "    upgrade           Bump patch, build, and install .deb"
	@echo "    upgrade-minor     Bump minor, build, and install .deb"
	@echo "    upgrade-major     Bump major, build, and install .deb"
	@echo "    bump [PART=patch] Bump version only (no build)"
	@echo ""
	@echo "  Maintenance"
	@echo "    clean             Remove dist/ and Cargo build artifacts"
	@echo "    icon              Regenerate all icon sizes from app_icon.png"
	@echo ""

# ─── Development ──────────────────────────────────────────────────────────────

deps:
	npm install

dev: deps
	npm run tauri dev

# ─── Quality ──────────────────────────────────────────────────────────────────

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

test-e2e:
	npm run test:e2e

# ─── Build ────────────────────────────────────────────────────────────────────

build: deps
	npm run tauri build

# ─── Install (Linux .deb) ─────────────────────────────────────────────────────
# apt needs a ./ prefix to recognise a local file path; without it, apt
# interprets the argument as a package name and fails with "Unable to locate".

_do_install_deb:
ifeq ($(UNAME), Linux)
	@DEB=$$(find src-tauri/target/release/bundle/deb -maxdepth 1 -name '*.deb' | head -1); \
	if [ -z "$$DEB" ]; then \
		echo "Error: No .deb found in src-tauri/target/release/bundle/deb/ — run 'make build' first."; \
		exit 1; \
	fi; \
	echo "Installing: $$DEB"; \
	sudo dpkg -i "$$DEB"; \
	sudo apt-get install -f -y; \
	gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true; \
	update-desktop-database 2>/dev/null || true
else
	@echo "Note: .deb install is Linux-only."
	@echo "      On macOS: open src-tauri/target/release/bundle/dmg/*.dmg"
endif

# build first, then install
install: build _do_install_deb

# install already-built bundle without rebuilding
install-deb: _do_install_deb

# ─── AppImage ─────────────────────────────────────────────────────────────────

install-appimage:
ifeq ($(UNAME), Linux)
	@APP=$$(ls -1 src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -1); \
	if [ -z "$$APP" ]; then \
		echo "Error: No .AppImage found — run 'make build' first."; \
		exit 1; \
	fi; \
	chmod +x "$$APP"; \
	echo "Launching: $$APP"; \
	"$$APP" &
else
	@echo "AppImage is Linux-only."
endif

# ─── Release ──────────────────────────────────────────────────────────────────

release: deps lint typecheck build
	@echo ""
	@echo "  Build complete. Bundles are in src-tauri/target/release/bundle/"
	@echo ""

# ─── Upgrade (bump + build + install) ─────────────────────────────────────────
# Bump the semver version across package.json, tauri.conf.json, and Cargo.toml,
# then build and install the .deb package in one step.

PART ?= patch

bump:
	@bash scripts/bump-version.sh $(PART)

upgrade: bump install
	@echo ""
	@echo "  ✔ Upgrade complete (patch)"
	@echo ""

upgrade-minor:
	$(MAKE) PART=minor upgrade
	@echo "  ✔ Upgrade complete (minor)"

upgrade-major:
	$(MAKE) PART=major upgrade
	@echo "  ✔ Upgrade complete (major)"

# ─── Maintenance ──────────────────────────────────────────────────────────────

clean:
	rm -rf dist
	cargo clean --manifest-path src-tauri/Cargo.toml
	@echo "Cleaned dist/ and Cargo build artifacts."

# ─── Icons ─────────────────────────────────────────────────────────────────────
# Regenerate all bundled icon sizes (32x32, 128x128, .icns, .ico, etc.)
# from the single source file app_icon.png using the Tauri CLI.
# Run this whenever app_icon.png is updated, then rebuild.

icon:
	npx tauri icon app_icon.png
	@echo "Icons regenerated in src-tauri/icons/. Rebuild the app to apply."
