/* exported init */
/*
 * Copyright 2014 Red Hat, Inc
 * Copyright 2020 Endless, Inc
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */
const { Clutter, Gio, GLib, GObject, St } = imports.gi;

const Background = imports.ui.background;
const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Layout = imports.ui.layout;
const Main = imports.ui.main;

var IconContainer = GObject.registerClass(
class IconContainer extends St.Widget {
    _init(params) {
        super._init(params);

        this.connect('notify::scale-x', () => {
            this.queue_relayout();
        });
        this.connect('notify::scale-y', () => {
            this.queue_relayout();
        });
    }

    vfunc_get_preferred_width(forHeight) {
        const width = super.vfunc_get_preferred_width(forHeight);
        return width.map(w => w * this.scale_x);
    }

    vfunc_get_preferred_height(forWidth) {
        const height = super.vfunc_get_preferred_height(forWidth);
        return height.map(h => h * this.scale_y);
    }
});

var Watermark = GObject.registerClass(
class Watermark extends St.Widget {
    _init(backgroundActor) {
        this._backgroundActor = backgroundActor;
        this._monitorIndex = this._backgroundActor.monitor;

        this._watermarkFile = null;
        this._forceWatermarkVisible = false;

        this._settings = ExtensionUtils.getSettings();

        this._settings.connect('changed::watermark-file',
            this._updateWatermark.bind(this));
        this._settings.connect('changed::watermark-size',
            this._updateScale.bind(this));
        this._settings.connect('changed::watermark-position',
            this._updatePosition.bind(this));
        this._settings.connect('changed::watermark-border',
            this._updateBorder.bind(this));
        this._settings.connect('changed::watermark-opacity',
            this._updateOpacity.bind(this));
        this._settings.connect('changed::watermark-always-visible',
            this._updateVisibility.bind(this));

        this._textureCache = St.TextureCache.get_default();
        this._textureCache.connect('texture-file-changed', (cache, file) => {
            if (!this._watermarkFile || !this._watermarkFile.equal(file))
                return;
            this._updateWatermarkTexture();
        });

        super._init({
            layout_manager: new Clutter.BinLayout(),
            opacity: 0,
        });
        this._backgroundActor.add_child(this);

        this.connect('destroy', this._onDestroy.bind(this));

        this._backgroundActor.content.connect('notify::brightness',
            this._updateOpacity.bind(this));

        this.add_constraint(new Layout.MonitorConstraint({
            index: this._monitorIndex,
            work_area: true,
        }));

        this._bin = new IconContainer({ x_expand: true, y_expand: true });
        this.add_actor(this._bin);
        this._bin.connect('resource-scale-changed',
            this._updateWatermarkTexture.bind(this));

        this._updateWatermark();
        this._updatePosition();
        this._updateBorder();
        this._updateOpacity();
        this._updateVisibility();
    }

    _loadBrandingFile() {
        const WATERMARK_CUSTOM_BRANDING_FILE = `${Config.LOCALSTATEDIR}/lib/eos-image-defaults/branding/gnome-shell.conf`;

        try {
            const keyfile = new GLib.KeyFile();
            keyfile.load_from_file(WATERMARK_CUSTOM_BRANDING_FILE, GLib.KeyFileFlags.NONE);
            return keyfile.get_string('Watermark', 'logo');
        } catch (e) {
            return null;
        }
    }

    _updateWatermark() {
        let filename = this._settings.get_string('watermark-file');
        const brandingFile = this._loadBrandingFile();

        // If there's no GSettings file, but there is a custom file, use
        // the custom file instead and make sure it is visible
        if (!filename && brandingFile) {
            filename = brandingFile;
            this._forceWatermarkVisible = true;
        } else {
            this._forceWatermarkVisible = false;
        }

        const file = Gio.File.new_for_commandline_arg(filename);
        if (this._watermarkFile && this._watermarkFile.equal(file))
            return;

        this._watermarkFile = file;

        this._updateWatermarkTexture();
    }

    _updateOpacity() {
        const brightness = this._backgroundActor.content.vignette
            ? this._backgroundActor.content.brightness : 1.0;
        this._bin.opacity =
            this._settings.get_uint('watermark-opacity') * brightness;
    }

    _getWorkArea() {
        return Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
    }

    _getWidthForRelativeSize(size) {
        const { width } = this._getWorkArea();
        return width * size / 100;
    }

    _updateWatermarkTexture() {
        if (this._icon)
            this._icon.destroy();
        this._icon = null;

        const key = this._settings.settings_schema.get_key('watermark-size');
        const [, range] = key.get_range().deep_unpack();
        const [, max] = range.deep_unpack();
        const width = this._getWidthForRelativeSize(max);

        const resourceScale = this._bin.get_resource_scale();
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._icon = this._textureCache.load_file_async(this._watermarkFile, width, -1, scaleFactor, resourceScale);
        this._icon.connect('notify::content',
            this._updateScale.bind(this));
        this._bin.add_actor(this._icon);
    }

    _updateScale() {
        if (!this._icon || this._icon.width === 0)
            return;

        const size = this._settings.get_double('watermark-size');
        const width = this._getWidthForRelativeSize(size);
        const scale = width / this._icon.width;
        this._bin.set_scale(scale, scale);
    }

    _updatePosition() {
        let xAlign, yAlign;
        switch (this._settings.get_string('watermark-position')) {
        case 'center':
            xAlign = Clutter.ActorAlign.CENTER;
            yAlign = Clutter.ActorAlign.CENTER;
            break;
        case 'bottom-left':
            xAlign = Clutter.ActorAlign.START;
            yAlign = Clutter.ActorAlign.END;
            break;
        case 'bottom-center':
            xAlign = Clutter.ActorAlign.CENTER;
            yAlign = Clutter.ActorAlign.END;
            break;
        case 'bottom-right':
            xAlign = Clutter.ActorAlign.END;
            yAlign = Clutter.ActorAlign.END;
            break;
        }
        this._bin.x_align = xAlign;
        this._bin.y_align = yAlign;
    }

    _updateBorder() {
        const border = this._settings.get_uint('watermark-border');
        this.style = 'padding: %dpx;'.format(border);
    }

    _updateVisibility() {
        const { background } = this._backgroundActor.content;
        const defaultUri = background._settings.get_default_value('picture-uri');
        const file = Gio.File.new_for_commandline_arg(defaultUri.deep_unpack());

        let visible;
        if (this._forceWatermarkVisible ||
            this._settings.get_boolean('watermark-always-visible'))
            visible = true;
        else if (background._file)
            visible = background._file.equal(file);
        else // background == NONE
            visible = false;

        this.ease({
            opacity: visible ? 255 : 0,
            duration: Background.FADE_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _onDestroy() {
        this._settings.run_dispose();
        this._settings = null;

        this._watermarkFile = null;
    }
});


class Extension {
    constructor() {
        this._bgManagerProto = Background.BackgroundManager.prototype;
        this._createBackgroundOrig = this._bgManagerProto._createBackgroundActor;
    }

    _reloadBackgrounds() {
        Main.layoutManager._updateBackgrounds();
        Main.overview._updateBackgrounds();
    }

    enable() {
        const { _createBackgroundOrig } = this;

        this._bgManagerProto._createBackgroundActor = function () {
            const backgroundActor = _createBackgroundOrig.call(this);
            const logo_ = new Watermark(backgroundActor);

            return backgroundActor;
        };
        this._reloadBackgrounds();
    }

    disable() {
        this._bgManagerProto._createBackgroundActor = this._createBackgroundOrig;
        this._reloadBackgrounds();
    }
}

function init() {
    return new Extension();
}
