from ai_applying.backend_client import BackendClient

def main():
    client = BackendClient(base_url="https://httpbin.org", timeout_seconds=10)
    resp = client.get("/get", params={"test": "1"})
    print("status: ", resp.get("args"))

if __name__ == "__main__":
    main()
