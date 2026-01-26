import { Injectable } from "@nestjs/common";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { EnvironmentService } from "../config/environment.service";

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly env: EnvironmentService) {
    const endpoint = this.env.getS3Endpoint();
    const region = this.env.getS3Region();
    const accessKeyId = this.env.getS3AccessKeyId();
    const secretAccessKey = this.env.getS3SecretAccessKey();
    this.bucket = this.env.getS3Bucket();

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  get bucketName(): string {
    return this.bucket;
  }

  listBuckets() {
    return this.client.send(new ListBucketsCommand({}));
  }

  listObjects(prefix?: string, continuationToken?: string, maxKeys = 50) {
    return this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken || undefined,
        MaxKeys: maxKeys,
      })
    );
  }

  upload(key: string, body: Buffer, contentType?: string) {
    return this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  download(key: string) {
    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  delete(key: string) {
    return this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}
