import importlib, traceback, os, sys

print('CWD=', os.getcwd())
print('PYTHONPATH entries:')
for p in sys.path[:5]:
    print(' -', p)
print('\nDir listing:')
for name in sorted(os.listdir('.')):
    print(' *', name)

try:
    importlib.import_module('ai_applying.server')
    print('IMPORT_OK')
except Exception:
    traceback.print_exc()
    print('IMPORT_FAILED')
