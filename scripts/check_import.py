import importlib, traceback, os, sys

print('CWD=', os.getcwd())
print('PYTHONPATH entries:')
for p in sys.path:
    print(' -', p)
print('\nDir listing:')
for name in sorted(os.listdir('.')):
    print(' *', name)

try:
    importlib.import_module('ai_applying.server')
    print('IMPORT_OK')
except Exception as e:
    print('\033[91m')  # vermelho
    traceback.print_exc()
    print('IMPORT_FAILED:', type(e).__name__, str(e))
    print('\033[0m')
    sys.exit(1)
