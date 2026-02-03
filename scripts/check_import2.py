import sys, os, traceback

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
print('Inserting root to sys.path:', root)
sys.path.insert(0, root)
print('sys.path[0]=', sys.path[0])

try:
    import ai_applying.server as s
    print('IMPORT_OK')
except Exception:
    traceback.print_exc()
    print('IMPORT_FAILED')
