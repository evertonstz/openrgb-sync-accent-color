NAME=openrgb-sync-accent-color
UUID=openrgb-sync-accent-color@evertonstz.github.io
SCHEMA_FILE=org.gnome.shell.extensions.openrgb-sync-accent-color.gschema.xml

.PHONY: all pack install clean test test-watch test-coverage test-silent lint format check lint-fix format-fix check-fix dev help

all: dist/extension.js

# Help target
help:
	@echo "Available targets:"
	@echo "  all           - Build the extension (default)"
	@echo "  pack          - Create zip package for distribution"
	@echo "  install       - Install extension to GNOME Shell"
	@echo "  test          - Run tests once"
	@echo "  test-watch    - Run tests in watch mode"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-silent   - Run tests with minimal output"
	@echo "  lint          - Run linter (check only)"
	@echo "  format        - Run formatter (check only)"
	@echo "  check         - Run linter and formatter (check only)"
	@echo "  lint-fix      - Run linter and fix issues"
	@echo "  format-fix    - Run formatter and fix issues"
	@echo "  check-fix     - Run linter and formatter and fix issues"
	@echo "  dev           - Run linter, formatter, tests, and build"
	@echo "  clean         - Remove build artifacts"
	@echo "  help          - Show this help message"

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules *.ts src/openrgb/*.ts
	npx tsc

schemas/gschemas.compiled: schemas/$(SCHEMA_FILE)
	glib-compile-schemas schemas

$(NAME).zip: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@cp -r schemas dist/
	@cp metadata.json dist/
	@(cd dist && zip ../$(NAME).zip -9r .)

pack: $(NAME).zip

install: $(NAME).zip
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(UUID)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)
	@mkdir -p ~/.local/share/gnome-shell/extensions
	@cp -r dist ~/.local/share/gnome-shell/extensions/$(UUID)

# Test targets
test: node_modules
	@echo "Running tests..."
	npm run test:run

test-watch: node_modules
	@echo "Running tests in watch mode..."
	npm run test

test-silent: node_modules
	@echo "Running tests (silent)..."
	@npm run test:run --silent

# Biome targets
lint: node_modules
	@echo "Running linter..."
	npm run lint

format: node_modules
	@echo "Checking formatting..."
	npm run format

check: node_modules
	@echo "Running linter and formatter checks..."
	npm run check

lint-fix: node_modules
	@echo "Running linter and fixing issues..."
	npm run lint:fix

format-fix: node_modules
	@echo "Running formatter and fixing issues..."
	npm run format:fix

check-fix: node_modules
	@echo "Running linter and formatter and fixing issues..."
	npm run check:fix

# Development workflow
dev: node_modules
	@echo "Running full development workflow..."
	@echo "1. Checking code quality..."
	npm run check
	@echo "2. Running tests..."
	npm run test:run
	@echo "3. Building extension..."
	npx tsc
	@echo "Development workflow complete!"

clean:
	@rm -rf dist node_modules $(NAME).zip
