export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "Default Auth Test" },
      },
    ],
  };
}
