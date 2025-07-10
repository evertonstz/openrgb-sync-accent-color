NAME=openrgb-sync-accent-color
UUID=openrgb-sync-accent-color@evertonstz.github.io
SCHEMA_FILE=org.gnome.shell.extensions.openrgb-sync-accent-color.gschema.xml

.PHONY: all pack install clean

all: dist/extension.js

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules *.ts src/openrgb/*.ts
	npx tsc

schemas/gschemas.compiled: schemas/$(SCHEMA_FILE)
	glib-compile-schemas schemas

$(NAME).zip: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@cp -r schemas dist/
	@cp -r src dist/
	@cp metadata.json dist/
	@(cd dist && zip ../$(NAME).zip -9r .)

pack: $(NAME).zip

install: $(NAME).zip
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(UUID)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)
	@mkdir -p ~/.local/share/gnome-shell/extensions
	@cp -r dist ~/.local/share/gnome-shell/extensions/$(UUID)

clean:
	@rm -rf dist node_modules $(NAME).zip
