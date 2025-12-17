export default function () {
  return {
    cascade: [
      {
        endpoint: "/error/allowed",
        service: "main",
        method: "POST",
        allowedErrorCodes: ["allowedError"],
      },
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "After Error" },
      },
    ],
  };
}
