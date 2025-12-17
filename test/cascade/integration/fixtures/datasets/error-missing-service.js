export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "missingService",
        dtoIn: { name: "Test" },
      },
    ],
  };
}
