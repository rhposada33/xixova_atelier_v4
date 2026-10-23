export type ConnectMediaRole = "cover" | "gallery" | "floor_plan";
export interface ConnectMediaAsset {
  assetId: string;
  role: ConnectMediaRole;
  unitId: string | null;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  checksum: string;
  version: number;
}
export interface ConnectAdminMediaAsset extends ConnectMediaAsset {
  published: boolean;
  uploadState: "pending" | "ready" | "deleted" | "legacy";
  sizeBytes: number;
}
export interface Optional3DAssetManifest {
  projectId: string;
  assetId: string;
  format: "model/gltf-binary";
  version: number;
  visibility: "public" | "private";
  checksum: string;
  authorizedUrl: string;
}
