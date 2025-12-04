# Admin Features Documentation

This document describes hidden administrative features available for database maintenance and troubleshooting.

## Category Fix Function

### Purpose
A Cloud Function that allows administrators to reassign the latest version of a project to a different category without requiring user authentication.

### Function Details
- **Name**: `fixCategoryHttp`
- **Type**: HTTP-triggered Cloud Function
- **URL**: `https://us-central1-dsng-app.cloudfunctions.net/fixCategoryHttp`
- **Authentication**: None required (admin task)

### Usage

To move the latest version in "Maison à Irlande" project to a specific category:

```bash
curl -X POST https://us-central1-dsng-app.cloudfunctions.net/fixCategoryHttp \
  -H "Content-Type: application/json" \
  -d '{"newCategory": "Your Category Name"}'
```

**Example:**
```bash
curl -X POST https://us-central1-dsng-app.cloudfunctions.net/fixCategoryHttp \
  -H "Content-Type: application/json" \
  -d '{"newCategory": "Plan Électrique"}'
```

### Response Format

**Success:**
```json
{
  "success": true,
  "message": "Successfully updated version \"filename.pdf\" to category \"Plan Électrique\"",
  "details": {
    "fileName": "Plan-Final - Sylvain St-Germain - 11 Nov 2025-E101.pdf",
    "oldCategory": "Main Plans",
    "newCategory": "Plan Électrique",
    "categoryVersionNumber": 1
  }
}
```

**Already in target category:**
```json
{
  "success": true,
  "message": "Version is already in \"Plan Électrique\" category",
  "version": "filename.pdf"
}
```

**Error:**
```json
{
  "error": "Error message"
}
```

### How It Works

1. Queries Firestore for the project named "Maison à Irlande"
2. Finds the latest version (by timestamp)
3. Calculates the next version number for the target category
4. Updates the version's category and categoryVersionNumber
5. Sets the project's activeCategory to the new category
6. Returns success response with details

### Security Considerations

⚠️ **Important**: This function has no authentication and should be removed after use or restricted to specific IP addresses in production.

**To remove the function:**
```bash
firebase functions:delete fixCategoryHttp
```

### Source Code Location
- Function definition: `/functions/src/index.ts` (line ~496)
- Deployed: `us-central1` region

### Use Cases
- Fixing incorrect category assignments
- Migrating versions between categories
- Database maintenance after bugs
- One-time data corrections

### Limitations
- Only works for "Maison à Irlande" project (hardcoded)
- Always updates the LATEST version only
- No undo functionality (manual database edit required to revert)

---

## Future Admin Features

Consider implementing:
- Authenticated admin panel for database operations
- Bulk category reassignment
- Version deletion/restoration
- Project-wide category migrations
