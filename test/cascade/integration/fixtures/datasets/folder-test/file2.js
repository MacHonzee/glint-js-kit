export default function () {
  return {
    cascade: [
      {
        endpoint: "/user/create",
        service: "main",
        dtoIn: { name: "File2 User" },
        saveAs: "file2User",
      },
    ],
  };
}
