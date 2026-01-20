export default function () {
  return {
    cascade: [
      {
        endpoint: "/error/allowed",
        service: "main",
        method: "POST",
        allowedErrorCodes: ["allowedError"],
        expectError: {
          status: 400,
          "data.code": "allowedError",
          "data.message": { toContain: "allowed" },
        },
      },
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "After Error" },
        expect: {
          status: 200,
          "data.name": "Created User",
        },
      },
    ],
  };
}
