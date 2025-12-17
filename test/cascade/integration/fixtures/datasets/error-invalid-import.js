export default function () {
  return {
    cascade: [
      {
        import: "./non-existent-file.js",
      },
    ],
  };
}
