export default function () {
  return {
    cascade: [
      {
        endpoint: "/error/400",
        service: "main",
        method: "GET",
        // No allowedErrorCodes - should fail
      },
    ],
  };
}
