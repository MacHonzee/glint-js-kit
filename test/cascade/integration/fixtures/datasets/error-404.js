export default function () {
  return {
    cascade: [
      {
        endpoint: "/error/404",
        service: "main",
        method: "GET",
        // No allowedErrorCodes - should fail
      },
    ],
  };
}
