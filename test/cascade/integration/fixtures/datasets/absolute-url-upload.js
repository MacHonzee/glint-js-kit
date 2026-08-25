/**
 * Absolute URL + binary body upload (simulates signed GCS / fake-gcs media upload)
 */
export default function (_env, state, options = {}) {
  const uploadUrl = options.uploadUrl || state.params?.uploadUrl;
  const fixtureJpeg = options.fixtureJpeg || state.params?.fixtureJpeg || Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  return {
    cascade: [
      {
        url: uploadUrl,
        method: "PUT",
        body: fixtureJpeg,
        headers: { "Content-Type": "image/jpeg" },
        auth: false,
        expect: { status: 200 },
        saveAs: "photoUploadResponse",
      },
    ],
  };
}
