import { Project, Comment, UserRole } from "../types";
import { v4 as uuidv4 } from "uuid";

/**
 * Creates a sample project for onboarding new users
 * This project includes example comments and a welcome design
 */
export const createSampleProject = (
  userId: string,
  userEmail: string,
): Project => {
  const projectId = `sample-${userId}`;
  const now = Date.now();

  // Example comments to demonstrate the collaboration features
  const exampleComments: Comment[] = [
    {
      id: uuidv4(),
      text: "Welcome! This is an example comment. Click anywhere on the design to add your own.",
      author: UserRole.DESIGNER,
      authorName: "Revyze Team",
      timestamp: now - 3600000, // 1 hour ago
      position: { x: 25, y: 30 },
      pageNumber: 1,
      resolved: false,
      audience: "pro-owner",
      replies: [
        {
          id: uuidv4(),
          text: "You can also reply to comments to have discussions!",
          author: UserRole.HOMEOWNER,
          timestamp: now - 1800000, // 30 min ago
        },
      ],
    },
    {
      id: uuidv4(),
      text: "Try zooming in to see details better. Use the zoom controls or your scroll wheel.",
      author: UserRole.DESIGNER,
      authorName: "Revyze Team",
      timestamp: now - 7200000, // 2 hours ago
      position: { x: 60, y: 50 },
      pageNumber: 1,
      resolved: false,
      audience: "pro-owner",
      replies: [],
    },
    {
      id: uuidv4(),
      text: "This comment has been resolved! ✓",
      author: UserRole.DESIGNER,
      authorName: "Revyze Team",
      timestamp: now - 10800000, // 3 hours ago
      position: { x: 75, y: 70 },
      pageNumber: 1,
      resolved: true,
      audience: "pro-owner",
      replies: [],
    },
  ];

  const sampleProject: Project = {
    id: projectId,
    ownerId: userId,
    ownerEmail: userEmail,
    collaborators: [],
    name: "Welcome to Revyze! 👋",
    clientName: "Onboarding Tutorial",
    lastModified: now,
    createdAt: now,
    currentVersionId: "v1",
    versions: [
      {
        id: "v1",
        versionNumber: 1,
        fileUrl: "/onboarding-welcome.png", // We'll use a static welcome image
        fileName: "welcome-design.png",
        uploadedBy: UserRole.DESIGNER,
        uploaderEmail: "team@revyze.app",
        timestamp: now,
        comments: exampleComments,
      },
    ],
    shareSettings: {
      enabled: false,
      accessLevel: "view",
      shareToken: "",
    },
  };

  return sampleProject;
};

/**
 * Check if a project is the sample onboarding project
 */
export const isSampleProject = (projectId: string): boolean => {
  return projectId.startsWith("sample-");
};
