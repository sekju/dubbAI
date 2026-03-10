describe("API base URL resolution", () => {
  const originalBackendUrl = process.env.BACKEND_URL;
  const originalPublicBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  afterEach(() => {
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }

    if (originalPublicBackendUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
    } else {
      process.env.NEXT_PUBLIC_BACKEND_URL = originalPublicBackendUrl;
    }
  });

  it("prefers the internal backend URL for server-side requests", async () => {
    process.env.BACKEND_URL = "http://api:8000";
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:8000";

    const { getApiBaseUrl } = await import("@/lib/api");

    expect(getApiBaseUrl({ isServer: true })).toBe("http://api:8000");
  });

  it("uses the public backend URL in the browser", async () => {
    process.env.BACKEND_URL = "http://api:8000";
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:8000";

    const { getApiBaseUrl } = await import("@/lib/api");

    expect(getApiBaseUrl({ isServer: false })).toBe("http://localhost:8000");
  });
});
