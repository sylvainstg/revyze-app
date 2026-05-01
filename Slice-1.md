⏺ Slice 1 complete. Here's what shipped:                                                     
                                                                                                                          
  New files                                                                                                               
  - types.ts — FurnitureItem, ProjectScale, LengthUnit, LengthSystem; extended User, Project, ProjectVersion              
  - utils/scaleConversion.ts — cm⇄unit, page-percent⇄cm, format helpers, computeProjectScale                              
  - data/furnitureLibrary.ts — 25 categorized items (bedroom/living/dining/office/kitchen/bathroom/storage) with default  
  cm dimensions and inline SVG placeholders                                                                             
  - components/CalibrationOverlay.tsx — two-click capture → distance popover → 100cm verify square → Looks right /        
  Recalibrate                                                                                                             
  - components/FurnitureLayer.tsx — cm→percent rendering, drag/resize/rotate handles, soft-delete on Delete key, batched  
  commit on mouseup (no per-frame Firestore writes)                                                                       
  - components/FurniturePalette.tsx — Library tab (categorized grid, click to place) + Upload tab (file → real-world W×H  
  prompt → place)                                                                                                         
  - components/FurnitureInspector.tsx — top-left card with label, size inputs in user's unit, rotation slider with snap,  
  z-order, delete                                                                                                         
                                                                                                                          
  Modified                                                                                                                
  - services/storageService.ts — furnitureItemsJson round-trip in saveProject, sanitizeProject, getSharedProject (also    
  fixed pre-existing missing moodBoardElementsJson deserialization in getSharedProject)                                   
  - components/PDFWorkspace.tsx — new toolbar row (Tools: Comment / Furniture / Calibrate, Layers: Comments / Furniture
  eye-toggles), mode + commentsVisible + furnitureVisible + selectedFurnitureId state, mounted FurnitureLayer +           
  CalibrationOverlay inside pdfWrapperRef, mounted Palette + Inspector at workspace level, handlePdfClick gated on mode   
  === "comment"                                                                                                         
  - App.tsx — handleUpdateFurnitureItems, handleUpdateProjectScale mirroring handleUpdateMoodBoardElements; new props     
  passed to <PDFWorkspace>                                                                                           
  - components/Dashboard.tsx — Metric/Imperial segmented control in Account Settings → Profile tab, persisted via existing
   updateUserProfile
                                                                                                                          
  Verified                                                  
  - tsc --noEmit: only pre-existing unrelated errors (firebaseConfig import.meta.env, sampleProject Comment shape,        
  ShareModal date-fns). Zero new errors.                                                                                  
  - vite build: succeeds.               
                                                                                                                          
  You'll need to test in browser: calibrate scale, place library items, drag/resize/rotate/delete, toggle layer
  visibility, upload a PNG with W×H, verify Metric/Imperial preference flips inspector readouts. npm run dev to start. 