export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Assertions Test User", email: "assertions@example.com" },
        saveAs: "testUser",
        expect: {
          status: 200,
          "data.id": { toBeGreaterThan: 0 },
          "data.name": "Created User",
          "data.email": { toMatch: "@example" },
        },
      },
      {
        endpoint: "/error/404",
        service: "main",
        method: "GET",
        expectError: {
          status: 404,
          "data.code": "notFound",
          "data.message": { toContain: "not found" },
        },
      },
    ],
  };
}
