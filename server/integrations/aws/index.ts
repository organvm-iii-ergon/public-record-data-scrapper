/**
 * AWS Integration Exports
 *
 * This module provides a unified interface for AWS services.
 * Currently supports S3 for document storage.
 */

export { S3Client, s3Client } from './s3'
export type { S3Config, S3Response, UploadResult, PresignedUrlResult } from './s3'
