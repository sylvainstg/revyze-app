import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebaseConfig";

const functions = getFunctions(app);

export interface SearchHit {
  thumbUrl: string;
  fullUrl: string;
  sourceUrl: string;
  title: string;
}

export interface ImportedImage {
  storageUrl: string;
  storagePath: string;
  contentType: string;
  size: number;
  attribution: { source: string; pageUrl?: string };
}

export const searchFurnitureImages = async (
  query: string,
): Promise<SearchHit[]> => {
  const callable = httpsCallable<
    { query: string },
    { hits: SearchHit[]; cached: boolean }
  >(functions, "searchFurnitureImages");
  const res = await callable({ query });
  return res.data.hits;
};

export const importFurnitureImage = async (params: {
  url: string;
  projectId: string;
  attributionSource?: string;
  attributionPageUrl?: string;
}): Promise<ImportedImage> => {
  const callable = httpsCallable<typeof params, ImportedImage>(
    functions,
    "fetchAndStoreFurnitureImage",
  );
  const res = await callable(params);
  return res.data;
};
