 Done. Summary of the unification:                                                                                                
                                                                                                                                   
  Changes                                                                                                                          
  - App.tsx — owns furnitureMode and selectedFurnitureId; handlePlaceFurniture lives here now (with imports for PlaceRequest,      
  generatePlaceholderImage, pagePercentToCm); right-column conditionally renders <FurniturePalette> when furnitureMode ===         
  "furniture", otherwise the existing <CollaborationPanel>. Both panels occupy the same w-96 slot, so the page area is always
  identical width.                                                                                                                 
  - components/PDFWorkspace.tsx — drops local paletteOpen state and the absolute-overlay <FurniturePalette> mount. mode and        
  selectedFurnitureId accept lifted props (with internal fallbacks for safety). The toolbar's "Furniture" button now just toggles  
  mode; App reacts by swapping the right panel.                                                                                    
  - components/FurniturePalette.tsx — root changed from absolute right-0 ... w-72 shadow-2xl z-30 to relative flex flex-col h-full 
  ... w-96 shrink-0, matching CollaborationPanel's footprint. onClose now means "back to comments" (sets furnitureMode back to     
  "comment").                                                                                                                      
                                                                                                                                   
  Behavior                                                                                                                         
  - Click toolbar's Furniture → mode switches → right panel becomes Furniture palette in the same column. Comments hidden.
  - Click the X in the palette header (or click Comment in toolbar) → back to feedback panel.                                      
  - Click Calibrate → enters calibrate mode, panel stays as feedback (calibrate is a transient canvas tool).
  - Page area width unchanged whether comments or furniture is showing.                                                            
                                                                                                                                   
  Verified                                                                                                                         
  - tsc --noEmit: only pre-existing unrelated errors.                                                                              
  - vite build: clean (✓ built in 2.61s).                                                                                          
                                                            
  Ready to test in browser. Any layout tweaks you want before Slice 3 (export integration + keyboard shortcuts)?                   
                                                                                                                                   
✻ Cooked for 7m 18s             