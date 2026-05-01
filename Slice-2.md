⏺ Slice 2 complete. Summary:                                                                                              
                                                                                                                          
  New files                                                                                                               
  - functions/src/furniture/searchImages.ts — searchFurnitureImages callable. Auth-gated. Calls Google Custom Search Image
   API. Caches results in Firestore furniture_search_cache/{queryHash} for 30 days. Returns up to 12 hits with            
  thumb/full/source/title.                                                                                                
  - functions/src/furniture/fetchAndStoreImage.ts — fetchAndStoreFurnitureImage callable. Auth-gated + verifies caller is 
  project owner or collaborator (by email). Server-side fetches the URL with 15s timeout and 8MB cap, validates image/*   
  content-type, uploads to projects/{projectId}/furniture/{uuid}.{ext} via admin SDK, returns a Firebase Storage download 
  URL with a token (CORS-safe for <canvas> export).                                                                      
  - services/furnitureSearchService.ts — thin httpsCallable wrappers: searchFurnitureImages(query) and                    
  importFurnitureImage({url, projectId, attribution...}).                          
                                                                                                                          
  Modified                                                                                                                
  - functions/src/index.ts — exports the two new callables.                                                               
  - functions/.env.example — added GOOGLE_CSE_KEY + GOOGLE_CSE_CX with setup instructions (Programmable Search Engine +   
  Custom Search API).                                                                                                     
  - components/FurniturePalette.tsx — added Search tab (debounced 400ms, results grid, click → server-side import → goes  
  to dimension prompt). Upload tab now also accepts a pasted Image URL that goes through the same import path (no         
  client-side hotlinking). Pending placement carries source kind + attribution through to placement.                      
  - components/PDFWorkspace.tsx — handlePlaceFurniture handles new search PlaceRequest variant; persists searchQuery +
  attribution on the FurnitureItem.                                                                                       
                                                                                                                          
  Verified
  - tsc --noEmit (functions): clean                                                                                       
  - npm run build (functions): clean                                                                                      
  - npm run build (app): clean (only pre-existing warnings)
                                                                                                                          
  Required user action before testing                                                                                     
  1. Create a Programmable Search Engine at https://programmablesearchengine.google.com — "Search the entire web", Image
  search ON, copy the Search engine ID.                                                                                   
  2. In Google Cloud Console, enable Custom Search API and create an API key.
  3. Either set local env: GOOGLE_CSE_KEY=… and GOOGLE_CSE_CX=… in functions/.env, or run:                                
  firebase functions:config:set google_cse.key="..." google_cse.cx="..."                                                  
  4. Deploy functions: cd functions && npm run deploy (or firebase deploy --only                                          
  functions:searchFurnitureImages,functions:fetchAndStoreFurnitureImage).                                                 
  5. Test in browser: open a project, calibrate scale, open Furniture palette → Search → query "modern sofa top view" →   
  click a thumbnail → enter dimensions → place.                 