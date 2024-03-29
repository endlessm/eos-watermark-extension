project('watermark-extension',
  version: '3.8.0',
  meson_version: '>= 0.40.0'
)

sources = [
  'extension.js'
]
extra_sources = ['COPYING']

schemas = ['com.endlessm.watermark-extension']

uuid = 'eos-watermark@endlessm.com'

datadir = get_option('datadir')
extensiondir = join_paths(datadir, 'gnome-shell', 'extensions')
schemadir = join_paths(datadir, 'glib-2.0', 'schemas')

have_schemas = schemas.length() > 0

metaconf = configuration_data()
metaconf.set('uuid', uuid)
if have_schemas
  metaconf.set('settings_schema', schemas[0])
endif

meta = [
  configure_file(
    input: 'metadata.json.in',
    output: 'metadata.json',
    configuration: metaconf
  )
]

install_data(sources + extra_sources + meta,
  install_dir: join_paths(extensiondir, uuid)
)

foreach s : schemas
  install_data('schemas/@0@.gschema.xml'.format(s),
    install_dir: schemadir
  )
endforeach

if have_schemas
  meson.add_install_script('meson-postinstall.sh')
endif

extension_tool = find_program('gnome-extensions', required: false)
if extension_tool.found()
  builddir = meson.current_build_dir()
  srcdir = meson.current_source_dir()

  command = [
    extension_tool,
    'pack',
    '--force',
    '--out-dir=@0@'.format(builddir),
    '--extra-source=@0@/metadata.json'.format(builddir)
  ]

  foreach s : extra_sources
    command += '--extra-source=@0@'.format(s)
  endforeach

  command += srcdir

  run_target('zip-file', command: command)
endif
