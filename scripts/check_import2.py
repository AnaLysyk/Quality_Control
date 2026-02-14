import sys, os, traceback

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
print('Inserting root to sys.path:', root)
sys.path.insert(0, root)
print('sys.path:')
for p in sys.path:
    print(' -', p)

try:
    import ai_applying.server as s
    print('IMPORT_OK')
except Exception as e:
    print('\033[91m')  # vermelho
    traceback.print_exc()
    print('IMPORT_FAILED:', type(e).__name__, str(e))
    print('\033[0m')
    sys.exit(1)
