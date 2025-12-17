export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "File1 User" },
        saveAs: "file1User",
      },
    ],
  };
}
