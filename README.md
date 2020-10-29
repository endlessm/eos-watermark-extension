# Watermark extension for GNOME Shell

This extension adds a watermark image asset on top of the desktop
background.

## Usage

With the extension installed, you can use `gsettings` to set a
watermark. See all the settings available in the
[com.endlessm.watermark-extension
schema](schemas/com.endlessm.watermark-extension.gschema.xml).

```
$ gsettings list-keys com.endlessm.watermark-extension
watermark-always-visible
watermark-size
watermark-opacity
watermark-file
watermark-border
watermark-position

$ gsettings describe com.endlessm.watermark-extension watermark-file
The full watermark file path

$ gsettings set com.endlessm.watermark-extension watermark-file /path/to/watermark.png
```
