import importlib.metadata as md
for pkg in ['supabase', 'httpx', 'pydantic', 'pydantic-settings']:
    try:
        print(pkg, md.version(pkg))
    except Exception as exc:
        print(pkg, 'error', exc)