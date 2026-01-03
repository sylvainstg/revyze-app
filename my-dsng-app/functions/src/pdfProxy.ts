import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const getPDF = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).send("Missing path parameter");
      return;
    }

    // Get the file from Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send("File not found");
      return;
    }

    // Stream the file to the response
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", "inline");

    file
      .createReadStream()
      .on("error", (error) => {
        console.error("Error streaming file:", error);
        res.status(500).send("Error streaming file");
      })
      .pipe(res);
  } catch (error) {
    console.error("Error fetching PDF:", error);
    res.status(500).send("Internal server error");
  }
});
