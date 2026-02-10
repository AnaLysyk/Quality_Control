import httpx
import sys


def main():
    base = "http://127.0.0.1:8000"
    try:
        with httpx.Client(timeout=10) as client:
            r1 = client.get(f"{base}/health")
            print("/health ->", r1.json())
            r2 = client.get(f"{base}/generate", params={"prompt": "local-check"})
            try:
                print("/generate ->", r2.json())
            except Exception:
                print("/generate -> text:", r2.text)
    except Exception as e:
        print("error connecting to server:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
